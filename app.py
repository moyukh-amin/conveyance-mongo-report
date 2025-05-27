import tornado.ioloop
import tornado.web
import motor.motor_tornado
import json
import functools
import csv
import io # For in-memory file handling
import xlsxwriter # For Excel export

from bson import ObjectId, json_util
from datetime import datetime, timedelta, timezone

import config
from utils import hash_password, check_password, generate_api_key # Import hashing utilities

# Global MongoDB client instance
db_client = None
# Ensure xlsxwriter is installed: pip install XlsxWriter

def get_db():
    """Returns the MongoDB database instance."""
    global db_client
    if db_client is None:
        client = motor.motor_tornado.MotorClient(config.MONGO_DATABASE_URI)
        try:
            db_name = config.MONGO_DATABASE_URI.split('/')[-1].split('?')[0]
            db_client = client[db_name]
        except IndexError:
            db_client = client.get_default_database() # Fallback if DB name not in URI
            if not db_client: # Still no DB
                 raise ValueError("Database name not found in MONGO_DATABASE_URI and no default database set.")
        print(f"Connected to database: {db_client.name}")
    return db_client

class BaseHandler(tornado.web.RequestHandler):
    def set_default_headers(self):
        self.set_header("Content-Type", "application/json")
        self.set_header("Access-Control-Allow-Origin", "*") # CORS for development, restrict in production
        self.set_header("Access-Control-Allow-Headers", "content-type, x-api-key")
        self.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

    def options(self):
        # Handle preflight CORS requests
        self.set_status(204)
        self.finish()

    def write_error(self, status_code, **kwargs):
        self.set_status(status_code)
        # Extract reason if available from kwargs or default to self._reason
        reason = kwargs.get("reason", getattr(self, "_reason", "Unknown error"))
        if "exc_info" in kwargs: # Log actual error for debugging
            print(f"Error: {kwargs['exc_info'][1]}")
        
        self.finish(json.dumps({
            "error": {
                "code": status_code,
                "message": reason,
            }
        }))

    async def get_current_user_identity(self):
        """
        Determines the current authenticated identity (user or API client).
        Priority: API Key > Session Cookie.
        Sets self.current_identity to a dict like:
        {'type': 'api', 'client_name': 'client1', 'roles': ['api_role']} or
        {'type': 'user', 'username': 'user1', 'roles': ['webapp_role']}
        or None if no valid authentication is found.
        """
        if hasattr(self, "_current_identity"): # Cache check
            return self._current_identity

        # 1. Check for API Key
        api_key_header = self.request.headers.get(config.API_KEY_HEADER)
        if api_key_header:
            db = get_db()
            # Important: Iterate through keys to check hash. Do NOT store raw keys in DB.
            # This is inefficient for many keys. Production systems might use a pre-hashed lookup key
            # or a more optimized strategy if performance is critical.
            all_api_keys = await db.api_keys.find({"is_active": True}).to_list(length=None)
            
            matched_key_info = None
            for key_doc in all_api_keys:
                if check_password(api_key_header, key_doc["key_hash"]): # Using check_password for bcrypt comparison
                    # Check expiry
                    if key_doc.get("expires_at") and key_doc["expires_at"] < datetime.now(timezone.utc):
                        # Log key expiry, but don't reveal it to client to avoid info leakage
                        print(f"API Key for {key_doc['client_name']} has expired.")
                        continue # Treat as invalid
                    matched_key_info = key_doc
                    break
            
            if matched_key_info:
                self._current_identity = {
                    "type": "api",
                    "client_name": matched_key_info["client_name"],
                    "roles": matched_key_info.get("roles", []),
                    "_id": str(matched_key_info["_id"])
                }
                # Optional: Update last_used_at for the API key
                # await db.api_keys.update_one({"_id": matched_key_info["_id"]}, {"$set": {"last_used_at": datetime.now(timezone.utc)}})
                return self._current_identity

        # 2. Check for WebApp User Session
        user_id_bytes = self.get_secure_cookie("user_id")
        if user_id_bytes:
            user_id = user_id_bytes.decode('utf-8')
            db = get_db()
            user = await db.users.find_one({"_id": ObjectId(user_id)})
            if user:
                self._current_identity = {
                    "type": "user",
                    "username": user["username"],
                    "roles": user.get("roles", []),
                    "_id": str(user["_id"])
                }
                return self._current_identity
        
        self._current_identity = None
        return None

    # Parameter parsing methods (from original BaseHandler)
    def get_query_param_date(self, param_name, required=True):
        date_str = self.get_argument(param_name, None)
        if not date_str and required:
            raise tornado.web.HTTPError(400, reason=f"Missing required parameter: {param_name}")
        if not date_str and not required: return None
        try: return datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError: raise tornado.web.HTTPError(400, reason=f"Invalid date format for {param_name}. Use YYYY-MM-DD.")
    def get_query_param_list(self, param_name):
        param_val = self.get_argument(param_name, None)
        return [item.strip() for item in param_val.split(",")] if param_val else []
    def get_pagination_params(self):
        try:
            page = int(self.get_argument("page", "1")); page_size = int(self.get_argument("page_size", str(config.DEFAULT_PAGE_SIZE)))
            page = max(1, page); page_size = max(1, min(page_size, config.MAX_PAGE_SIZE))
            return page, page_size
        except ValueError: raise tornado.web.HTTPError(400, reason="Invalid 'page' or 'page_size'. Must be integers.")
    def get_sort_params(self):
        sort_by = self.get_argument("sort_by", None); sort_order_str = self.get_argument("sort_order", "asc").lower()
        if sort_order_str not in ["asc", "desc"]: raise tornado.web.HTTPError(400, reason="Invalid 'sort_order'. Must be 'asc' or 'desc'.")
        return sort_by, 1 if sort_order_str == "asc" else -1
    def get_filter_params(self):
        filters = {}; # ... (implementation from original BaseHandler)
        for arg in self.request.arguments:
            if arg.startswith("column_filter_"):
                field_name = arg.replace("column_filter_", "")
                value = self.get_argument(arg)
                if value.lower() == "true": filters[field_name] = True
                elif value.lower() == "false": filters[field_name] = False
                elif value.isdigit(): filters[field_name] = int(value)
                else:
                    try: filters[field_name] = float(value)
                    except ValueError: filters[field_name] = value
        return filters


# --- Authentication Decorators ---
def authenticated_access(required_roles_any: list = None, allow_api=True, allow_webapp=True):
    """
    Decorator for methods that require authentication (either API key or webapp session).
    Optionally checks if the authenticated identity has any of the required_roles_any.
    """
    def decorator(method):
        @functools.wraps(method)
        async def wrapper(self: BaseHandler, *args, **kwargs):
            identity = await self.get_current_user_identity()

            if not identity:
                raise tornado.web.HTTPError(401, reason="Authentication required.")

            if identity['type'] == 'api' and not allow_api:
                raise tornado.web.HTTPError(403, reason="API key authentication not allowed for this endpoint.")
            if identity['type'] == 'user' and not allow_webapp:
                raise tornado.web.HTTPError(403, reason="Webapp session authentication not allowed for this endpoint.")

            if required_roles_any:
                user_roles = identity.get("roles", [])
                if not any(role in user_roles for role in required_roles_any):
                    raise tornado.web.HTTPError(403, reason=f"Access denied. Requires one of roles: {', '.join(required_roles_any)}.")
            
            return await method(self, *args, **kwargs)
        return wrapper
    return decorator


# --- Auth Handlers ---
class LoginHandler(BaseHandler):
    async def post(self):
        try:
            data = json.loads(self.request.body)
            username = data.get("username")
            password = data.get("password")
        except json.JSONDecodeError:
            raise tornado.web.HTTPError(400, reason="Invalid JSON format.")

        if not username or not password:
            raise tornado.web.HTTPError(400, reason="Username and password are required.")

        db = get_db()
        user = await db.users.find_one({"username": username})

        if user and check_password(password, user["hashed_password"]):
            if not user.get("roles") or config.ROLE_WEBAPP_USER not in user["roles"]:
                 raise tornado.web.HTTPError(403, reason="User not authorized for web application access.")
            
            self.set_secure_cookie("user_id", str(user["_id"]), expires_days=1) # Session cookie
            self.write(json.dumps({"message": "Login successful", "username": user["username"], "roles": user.get("roles", [])}))
        else:
            raise tornado.web.HTTPError(401, reason="Invalid username or password.")

class LogoutHandler(BaseHandler):
    async def post(self):
        # No need for @authenticated_access here as anyone can attempt to logout
        # but it will only clear cookie if one exists for this session.
        self.clear_cookie("user_id")
        self.write(json.dumps({"message": "Logout successful"}))


# --- Insight Handlers (Modified for Auth) ---
class AvailableFieldsHandler(BaseHandler): # No changes to internal logic, just auth wrapper
    @authenticated_access(required_roles_any=[config.ROLE_WEBAPP_USER, config.ROLE_API_CLIENT])
    async def get(self):
        # ... (original get method implementation)
        form_id = self.get_argument("form_id", None)
        if not form_id:
            raise tornado.web.HTTPError(400, reason="Missing required parameter: form_id")
        db = get_db()
        try:
            form_setting = await db.custom_form_settings.find_one({"form_id": form_id})
            if not form_setting: raise tornado.web.HTTPError(404, reason=f"Form settings not found for form_id: {form_id}")
            submission_collection_name = form_setting.get("collection_name")
            if not submission_collection_name: raise tornado.web.HTTPError(500, reason="Form setting is missing 'collection_name'")
            
            submission_fields = []
            if "fields" in form_setting and isinstance(form_setting["fields"], list):
                for field_def in form_setting["fields"]:
                    if isinstance(field_def, dict) and field_def.get("name"):
                         submission_fields.append({"name": f"submitted_data.{field_def['name']}", "label": field_def.get("label", field_def['name']), "type": field_def.get("type", "string"), "source": "submission"})
                    elif isinstance(field_def, str):
                        submission_fields.append({"name": f"submitted_data.{field_def}", "label": field_def, "type": "string", "source": "submission"})
            
            associated_fields = []
            associated_collection_name = form_setting.get("associated_with")
            if associated_collection_name:
                sample_doc = await db[associated_collection_name].find_one()
                if sample_doc:
                    for key, value in sample_doc.items():
                        if key == "_id": continue
                        field_type = "string"
                        if isinstance(value, bool): field_type = "boolean"
                        elif isinstance(value, int): field_type = "integer"
                        elif isinstance(value, float): field_type = "float"
                        elif isinstance(value, datetime): field_type = "datetime"
                        elif isinstance(value, list): field_type = "array"
                        elif isinstance(value, dict): field_type = "object"
                        associated_fields.append({"name": key, "label": key.replace("_", " ").title(), "type": field_type, "source": associated_collection_name})
            
            standard_fields = [
                {"name": "activity_date", "label": "Activity Date", "type": "date", "source": "base"},
                {"name": "so_id", "label": "SO ID", "type": "string", "source": "base"},
                {"name": "so_name", "label": "SO Name", "type": "string", "source": "base"},
                {"name": "tsm_name", "label": "TSM Name", "type": "string", "source": "hierarchy"},
                {"name": "rm_name", "label": "RM Name", "type": "string", "source": "hierarchy"},
                {"name": "product_type", "label": "Product Type", "type": "string", "source": "base"},
                {"name": "quantity", "label": "Quantity", "type": "number", "source": "base"},
                {"name": "amount", "label": "Amount", "type": "number", "source": "base"},
            ]
            all_fields = standard_fields + submission_fields + associated_fields
            self.write(json.dumps({"available_fields": all_fields}, default=json_util.default))
        except tornado.web.HTTPError: raise
        except Exception as e:
            self.set_status(500); self.write(json.dumps({"error": str(e)}, default=json_util.default))


class SODailyActivityBaseHandler(BaseHandler):
    # Decorator will be applied to get methods in subclasses
    async def _get_form_settings(self, form_id_str="SO_FORM_ID"): # ... (original)
        db = get_db()
        form_setting = await db.custom_form_settings.find_one({"form_id": form_id_str})
        if not form_setting: raise tornado.web.HTTPError(404, reason=f"Form settings not found for form_id: {form_id_str}")
        if not form_setting.get("collection_name"): raise tornado.web.HTTPError(500, reason=f"Form setting for {form_id_str} is missing 'collection_name'")
        return form_setting

    def _build_base_match_stage(self, target_date, product_type=None): # ... (original)
        start_date = datetime.combine(target_date, datetime.min.time()); end_date = datetime.combine(target_date, datetime.max.time())
        match_conditions = {"created_at": {"$gte": start_date, "$lte": end_date}, "status": "approved"}
        if product_type and product_type.lower() != "combined": match_conditions["submitted_data.product_type"] = product_type
        return {"$match": match_conditions}

    def _add_user_details_stage(self, pipeline, local_field="created_by", as_field="so_user_details"): # ... (original)
        pipeline.extend([{"$lookup": {"from": "users", "localField": local_field, "foreignField": "_id", "as": as_field}}, {"$unwind": {"path": f"${as_field}", "preserveNullAndEmptyArrays": True}}])

    def _add_associated_collection_stage(self, pipeline, form_settings, local_assoc_field="associated_with"): # ... (original)
        associated_collection_name = form_settings.get("associated_with")
        if associated_collection_name: pipeline.extend([{"$lookup": {"from": associated_collection_name, "localField": local_assoc_field, "foreignField": "_id", "as": "associated_data_docs"}}, {"$unwind": {"path": "$associated_data_docs", "preserveNullAndEmptyArrays": True}}])

    def _add_hierarchy_stages(self, pipeline, use_hierarchy=False, so_creator_id_field="so_creator_id"): # ... (original, with so_user_details._id fix)
        if not use_hierarchy:
            pipeline.append({"$addFields": {"tsm_name": {"$ifNull": ["$so_user_details.manager_name", "N/A"]}, "rm_name": {"$ifNull": ["$so_user_details.regional_manager_name", "N/A"]}}})
            return
        pipeline.extend([
            {"$lookup": {"from": "sub_orgs", "localField": so_creator_id_field, "foreignField": "user_id", "as": "so_sub_org_details"}}, {"$unwind": {"path": "$so_sub_org_details", "preserveNullAndEmptyArrays": True}},
            {"$lookup": {"from": "sub_orgs", "localField": "so_sub_org_details.parent_org_id", "foreignField": "_id", "as": "tsm_sub_org_details"}}, {"$unwind": {"path": "$tsm_sub_org_details", "preserveNullAndEmptyArrays": True}},
            {"$lookup": {"from": "users", "localField": "tsm_sub_org_details.user_id", "foreignField": "_id", "as": "tsm_user_details"}}, {"$unwind": {"path": "$tsm_user_details", "preserveNullAndEmptyArrays": True}},
            {"$lookup": {"from": "sub_orgs", "localField": "tsm_sub_org_details.parent_org_id", "foreignField": "_id", "as": "rm_sub_org_details"}}, {"$unwind": {"path": "$rm_sub_org_details", "preserveNullAndEmptyArrays": True}},
            {"$lookup": {"from": "users", "localField": "rm_sub_org_details.user_id", "foreignField": "_id", "as": "rm_user_details"}}, {"$unwind": {"path": "$rm_user_details", "preserveNullAndEmptyArrays": True}},
        ])
        
    def _get_dynamic_projection_stage(self, requested_fields, form_settings, use_hierarchy_for_names=False): # ... (original)
        project_stage = {
            "_id": 1, "activity_date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "so_id": "$so_user_details.employee_id", "so_name": {"$concat": ["$so_user_details.first_name", " ", "$so_user_details.last_name"]},
            "product_type": "$submitted_data.product_type",
            "quantity": {"$ifNull": [{"$convert": {"input": "$submitted_data.quantity", "to": "double", "onError": 0.0, "onNull": 0.0}}, 0.0]},
            "amount": {"$ifNull": [{"$convert": {"input": "$submitted_data.amount", "to": "double", "onError": 0.0, "onNull": 0.0}}, 0.0]},
        }
        if use_hierarchy_for_names:
            project_stage["tsm_name"] = {"$ifNull": [{"$concat": ["$tsm_user_details.first_name", " ", "$tsm_user_details.last_name"]}, "N/A"]}
            project_stage["rm_name"] = {"$ifNull": [{"$concat": ["$rm_user_details.first_name", " ", "$rm_user_details.last_name"]}, "N/A"]}
        else:
             project_stage["tsm_name"] = {"$ifNull": ["$tsm_name", "N/A"]} # From addFields stage
             project_stage["rm_name"] = {"$ifNull": ["$rm_name", "N/A"]}   # From addFields stage

        if not requested_fields or "*" in requested_fields:
            if "fields" in form_settings and isinstance(form_settings["fields"], list):
                for field_def in form_settings["fields"]:
                    field_name_str = field_def['name'] if isinstance(field_def, dict) and field_def.get("name") else (field_def if isinstance(field_def, str) else None)
                    if field_name_str and f"submitted_data.{field_name_str}" not in project_stage:
                        field_type = field_def.get("type", "string") if isinstance(field_def, dict) else "string"
                        path = f"$submitted_data.{field_name_str}"
                        if field_type in ["number", "integer", "float", "double"]: project_stage[field_name_str] = {"$ifNull": [{"$convert": {"input": path, "to": "double", "onError": 0.0, "onNull": 0.0}},0.0]}
                        else: project_stage[field_name_str] = { "$ifNull": [path, "N/A"] }
            # Add associated_data_docs fields if needed (placeholder)
        else:
            for field_path in requested_fields:
                output_field_name = field_path.split('.')[-1]
                db_field_path = ""
                if field_path.startswith("submitted_data."): db_field_path = f"${field_path}"
                elif field_path.startswith("associated_data_docs."): db_field_path = f"${field_path}"
                elif field_path in project_stage: continue
                else: db_field_path = f"$submitted_data.{field_path}" # Default assumption
                if db_field_path and output_field_name not in project_stage : project_stage[output_field_name] = db_field_path
        return {"$project": project_stage}

    def _add_search_filter_stages(self, pipeline, query_string, text_search_fields, column_filters): # ... (original)
        if query_string and text_search_fields:
            search_conditions = [{field: {"$regex": query_string, "$options": "i"}} for field in text_search_fields]
            if search_conditions: pipeline.append({"$match": {"$or": search_conditions}})
        if column_filters:
            filter_match = {}
            for field, value in column_filters.items():
                filter_match[field] = {"$regex": f"^{value}", "$options": "i"} if isinstance(value, str) else value
            if filter_match: pipeline.append({"$match": filter_match})
            
    def _add_sorting_stage(self, pipeline, sort_by, sort_order): # ... (original)
        if sort_by: pipeline.append({"$sort": {sort_by: sort_order}})

    def _add_pagination_stages(self, pipeline, page, page_size): # ... (original)
        pipeline.extend([{"$skip": (page - 1) * page_size}, {"$limit": page_size}])


class SODailyActivityDetailsHandler(SODailyActivityBaseHandler):
    @authenticated_access(required_roles_any=[config.ROLE_WEBAPP_USER, config.ROLE_API_CLIENT])
    async def get(self):
        try:
            target_date = self.get_query_param_date("date"); product_type = self.get_argument("product_type", None)
            requested_fields = self.get_query_param_list("fields"); page, page_size = self.get_pagination_params()
            sort_by, sort_order = self.get_sort_params(); query_string = self.get_argument("q", None)
            column_filters = self.get_filter_params(); use_hierarchy = self.get_argument("use_hierarchy", "false").lower() == "true"

            form_settings = await self._get_form_settings(); submission_collection_name = form_settings["collection_name"]; db = get_db()
            pipeline = [self._build_base_match_stage(target_date, product_type)]
            pipeline.append({"$project": {"_id": 1, "created_at": 1, "created_by": 1, "submitted_data": 1, "associated_with": 1}})
            self._add_user_details_stage(pipeline, local_field="created_by", as_field="so_user_details")
            self._add_associated_collection_stage(pipeline, form_settings, local_assoc_field="associated_with")
            self._add_hierarchy_stages(pipeline, use_hierarchy=use_hierarchy, so_creator_id_field="so_user_details._id") # Corrected field
            
            final_project_stage_def = self._get_dynamic_projection_stage(requested_fields, form_settings, use_hierarchy_for_names=use_hierarchy)
            pipeline.append(final_project_stage_def)
            
            searchable_fields = ["so_name", "product_type"] # Default
            if requested_fields and "*" not in requested_fields: searchable_fields.extend([f.split('.')[-1] for f in requested_fields if f.split('.')[-1] not in searchable_fields])
            elif "*" in requested_fields: searchable_fields.extend([k for k in final_project_stage_def["$project"].keys() if k not in searchable_fields and k != "_id"])
            self._add_search_filter_stages(pipeline, query_string, searchable_fields, column_filters)
            
            count_pipeline = pipeline + [{"$count": "total_items"}]
            self._add_sorting_stage(pipeline, sort_by, sort_order)
            self._add_pagination_stages(pipeline, page, page_size)
            
            results = await db[submission_collection_name].aggregate(pipeline).to_list(length=page_size)
            total_items_res = await db[submission_collection_name].aggregate(count_pipeline).to_list(length=1)
            total_items = total_items_res[0]["total_items"] if total_items_res else 0

            self.write(json.dumps({"pagination": {"page": page, "page_size": page_size, "total_items": total_items, "total_pages": (total_items + page_size - 1) // page_size}, "data": results}, default=json_util.default))
        except tornado.web.HTTPError: raise
        except Exception as e: import traceback; print(traceback.format_exc()); self.set_status(500); self.write(json.dumps({"error": str(e)}, default=json_util.default))


class SODailyActivityTSMSummaryHandler(SODailyActivityBaseHandler):
    @authenticated_access(required_roles_any=[config.ROLE_WEBAPP_USER, config.ROLE_API_CLIENT])
    async def get(self):
        try:
            target_date = self.get_query_param_date("date"); product_type = self.get_argument("product_type", None)
            requested_fields = self.get_query_param_list("fields"); page, page_size = self.get_pagination_params()
            sort_by, sort_order = self.get_sort_params(); query_string = self.get_argument("q", None)
            column_filters = self.get_filter_params(); use_hierarchy = self.get_argument("use_hierarchy", "true").lower() == "true"

            form_settings = await self._get_form_settings(); submission_collection_name = form_settings["collection_name"]; db = get_db()
            pipeline = [self._build_base_match_stage(target_date, product_type)]
            pipeline.append({"$project": {"created_by": 1, "submitted_data": 1, "associated_with": 1, "created_at": 1}})
            self._add_user_details_stage(pipeline, local_field="created_by", as_field="so_user_details")
            self._add_associated_collection_stage(pipeline, form_settings, local_assoc_field="associated_with")
            self._add_hierarchy_stages(pipeline, use_hierarchy=use_hierarchy, so_creator_id_field="so_user_details._id")

            pre_group_project = {"activity_date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}}, "so_id": "$so_user_details._id",
                                 "quantity": {"$ifNull": [{"$convert": {"input": "$submitted_data.quantity", "to": "double", "onError": 0.0, "onNull": 0.0}}, 0.0]},
                                 "amount": {"$ifNull": [{"$convert": {"input": "$submitted_data.amount", "to": "double", "onError": 0.0, "onNull": 0.0}}, 0.0]}}
            if use_hierarchy: pre_group_project["tsm_name"] = {"$ifNull": [{"$concat": ["$tsm_user_details.first_name", " ", "$tsm_user_details.last_name"]}, "N/A_Hierarchy"]}
            else: pre_group_project["tsm_name"] = {"$ifNull": ["$so_user_details.manager_name", "N/A_DirectManager"]}
            if requested_fields:
                for rf_path in requested_fields:
                    rf_out_name = rf_path.replace(".", "_")
                    if rf_path.startswith("submitted_data.") or rf_path.startswith("associated_data_docs."):
                        pre_group_project[rf_out_name] = {"$ifNull": [{"$convert": {"input": f"${rf_path}", "to": "double", "onError": 0.0, "onNull": 0.0}}, 0.0]}
            pipeline.append({"$project": pre_group_project})

            group_stage = {"_id": {"tsm_name": "$tsm_name", "activity_date": "$activity_date"}, "total_quantity": {"$sum": "$quantity"}, "total_amount": {"$sum": "$amount"}, "number_of_sos": {"$addToSet": "$so_id"}}
            if requested_fields:
                for rf_path in requested_fields:
                    rf_out_name = rf_path.replace(".", "_")
                    if rf_out_name in pre_group_project: group_stage[f"total_{rf_out_name}"] = {"$sum": f"${rf_out_name}"}
            pipeline.append({"$group": group_stage})

            final_summary_project = {"_id": 0, "tsm_name": "$_id.tsm_name", "activity_date": "$_id.activity_date", "total_quantity": 1, "total_amount": 1, "number_of_sos": {"$size": "$number_of_sos"}}
            if requested_fields:
                for rf_path in requested_fields:
                    rf_out_name = rf_path.replace(".", "_")
                    if f"total_{rf_out_name}" in group_stage: final_summary_project[f"total_{rf_out_name}"] = 1
            pipeline.append({"$project": final_summary_project})
            
            self._add_search_filter_stages(pipeline, query_string, ["tsm_name", "activity_date"], column_filters)
            count_pipeline = pipeline + [{"$count": "total_items"}]
            self._add_sorting_stage(pipeline, sort_by, sort_order)
            self._add_pagination_stages(pipeline, page, page_size)

            results = await db[submission_collection_name].aggregate(pipeline).to_list(length=page_size)
            total_items_res = await db[submission_collection_name].aggregate(count_pipeline).to_list(length=1)
            total_items = total_items_res[0]["total_items"] if total_items_res else 0
            self.write(json.dumps({"pagination": {"page": page, "page_size": page_size, "total_items": total_items, "total_pages": (total_items + page_size - 1) // page_size}, "data": results}, default=json_util.default))
        except tornado.web.HTTPError: raise
        except Exception as e: import traceback; print(traceback.format_exc()); self.set_status(500); self.write(json.dumps({"error": str(e)}, default=json_util.default))


class SODailyActivityOverallSummaryHandler(SODailyActivityBaseHandler):
    @authenticated_access(required_roles_any=[config.ROLE_WEBAPP_USER, config.ROLE_API_CLIENT])
    async def get(self):
        try:
            target_date = self.get_query_param_date("date"); product_type = self.get_argument("product_type", None)
            requested_fields = self.get_query_param_list("fields")
            form_settings = await self._get_form_settings(); submission_collection_name = form_settings["collection_name"]; db = get_db()
            pipeline = [self._build_base_match_stage(target_date, product_type)]
            pipeline.append({"$project": {"created_at": 1, "submitted_data": 1, "associated_with": 1}})
            self._add_associated_collection_stage(pipeline, form_settings, local_assoc_field="associated_with")

            pre_group_project = {"activity_date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
                                 "quantity": {"$ifNull": [{"$convert": {"input": "$submitted_data.quantity", "to": "double", "onError": 0.0, "onNull": 0.0}}, 0.0]},
                                 "amount": {"$ifNull": [{"$convert": {"input": "$submitted_data.amount", "to": "double", "onError": 0.0, "onNull": 0.0}}, 0.0]}}
            if requested_fields:
                for rf_path in requested_fields:
                    rf_out_name = rf_path.replace(".", "_")
                    if rf_path.startswith("submitted_data.") or rf_path.startswith("associated_data_docs."):
                        pre_group_project[rf_out_name] = {"$ifNull": [{"$convert": {"input": f"${rf_path}", "to": "double", "onError": 0.0, "onNull": 0.0}}, 0.0]}
            pipeline.append({"$project": pre_group_project})

            group_stage = {"_id": {"activity_date": "$activity_date"}, "overall_total_quantity": {"$sum": "$quantity"}, "overall_total_amount": {"$sum": "$amount"}}
            if requested_fields:
                for rf_path in requested_fields:
                    rf_out_name = rf_path.replace(".", "_")
                    if rf_out_name in pre_group_project: group_stage[f"overall_total_{rf_out_name}"] = {"$sum": f"${rf_out_name}"}
            pipeline.append({"$group": group_stage})
            
            final_overall_project = {"_id": 0, "activity_date": "$_id.activity_date", "overall_total_quantity": 1, "overall_total_amount": 1}
            if requested_fields:
                for rf_path in requested_fields:
                    rf_out_name = rf_path.replace(".", "_")
                    if f"overall_total_{rf_out_name}" in group_stage: final_overall_project[f"overall_total_{rf_out_name}"] = 1
            pipeline.append({"$project": final_overall_project})

            summary_data = await db[submission_collection_name].aggregate(pipeline).to_list(length=1)
            self.write(json.dumps({"data": summary_data[0] if summary_data else {}}, default=json_util.default))
        except tornado.web.HTTPError: raise
        except Exception as e: import traceback; print(traceback.format_exc()); self.set_status(500); self.write(json.dumps({"error": str(e)}, default=json_util.default))


# --- Export Handlers ---
class BaseExportHandler(SODailyActivityBaseHandler): # Inherits auth and basic filters
    async def generate_export_data(self, report_type: str, pipeline_modifier_func=None):
        target_date = self.get_query_param_date("date")
        product_type = self.get_argument("product_type", None)
        requested_fields_str = self.get_argument("fields", None) # Comma-separated string
        requested_fields = [rf.strip() for rf in requested_fields_str.split(',')] if requested_fields_str else []
        
        sort_by, sort_order = self.get_sort_params()
        query_string = self.get_argument("q", None)
        column_filters = self.get_filter_params()
        use_hierarchy = self.get_argument("use_hierarchy", "false").lower() == "true"
        
        # Default to true for TSM summary if not specified, aligning with TSMSummaryHandler
        if report_type == 'tsm_summary' and 'use_hierarchy' not in self.request.arguments:
            use_hierarchy = True


        form_settings = await self._get_form_settings()
        submission_collection_name = form_settings["collection_name"]
        db = get_db()

        pipeline = []
        # Common initial stages (match, initial project, user details, associated, hierarchy)
        pipeline.append(self._build_base_match_stage(target_date, product_type))
        pipeline.append({"$project": {"_id": 1, "created_at": 1, "created_by": 1, "submitted_data": 1, "associated_with": 1}})
        self._add_user_details_stage(pipeline, local_field="created_by", as_field="so_user_details")
        self._add_associated_collection_stage(pipeline, form_settings, local_assoc_field="associated_with")
        self._add_hierarchy_stages(pipeline, use_hierarchy=use_hierarchy, so_creator_id_field="so_user_details._id")

        # Report-specific pipeline modifications (projection, grouping)
        final_project_stage_def = None
        if report_type == 'details':
            final_project_stage_def = self._get_dynamic_projection_stage(requested_fields, form_settings, use_hierarchy_for_names=use_hierarchy)
            pipeline.append(final_project_stage_def)
            
            searchable_fields = ["so_name", "product_type"]
            if requested_fields and "*" not in requested_fields: searchable_fields.extend([f.split('.')[-1] for f in requested_fields if f.split('.')[-1] not in searchable_fields])
            elif "*" in requested_fields and final_project_stage_def: searchable_fields.extend([k for k in final_project_stage_def["$project"].keys() if k not in searchable_fields and k != "_id"])
            self._add_search_filter_stages(pipeline, query_string, searchable_fields, column_filters)

        elif report_type == 'tsm_summary':
            pre_group_project = {"activity_date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}}, "so_id": "$so_user_details._id",
                                 "quantity": {"$ifNull": [{"$convert": {"input": "$submitted_data.quantity", "to": "double", "onError": 0.0, "onNull": 0.0}}, 0.0]},
                                 "amount": {"$ifNull": [{"$convert": {"input": "$submitted_data.amount", "to": "double", "onError": 0.0, "onNull": 0.0}}, 0.0]}}
            if use_hierarchy: pre_group_project["tsm_name"] = {"$ifNull": [{"$concat": ["$tsm_user_details.first_name", " ", "$tsm_user_details.last_name"]}, "N/A_Hierarchy"]}
            else: pre_group_project["tsm_name"] = {"$ifNull": ["$so_user_details.manager_name", "N/A_DirectManager"]}
            
            # Handle requested_fields for summation (numeric fields)
            summable_fields_in_projection = {}
            if requested_fields: # These are original field paths from 'available_fields'
                for rf_path in requested_fields:
                    # Check if field is numeric based on available_fields (if possible, or assume numeric for simplicity)
                    # This part would be more robust if available_fields schema was accessible here
                    rf_out_name = rf_path.replace(".", "_") # Name in pre_group_project
                    if rf_path.startswith("submitted_data.") or rf_path.startswith("associated_data_docs."):
                        pre_group_project[rf_out_name] = {"$ifNull": [{"$convert": {"input": f"${rf_path}", "to": "double", "onError": 0.0, "onNull": 0.0}}, 0.0]}
                        summable_fields_in_projection[rf_out_name] = f"total_{rf_out_name}" # Store mapping for group stage
                    elif rf_path in ["quantity", "amount"]: # Base fields
                         summable_fields_in_projection[rf_path] = f"total_{rf_path}"


            pipeline.append({"$project": pre_group_project})

            group_stage = {"_id": {"tsm_name": "$tsm_name", "activity_date": "$activity_date"}, 
                           "total_quantity": {"$sum": "$quantity"}, "total_amount": {"$sum": "$amount"}, 
                           "number_of_sos": {"$addToSet": "$so_id"}}
            for proj_field, total_field_name in summable_fields_in_projection.items():
                 if proj_field not in ["quantity", "amount"]: # quantity and amount are already standard
                    group_stage[total_field_name] = {"$sum": f"${proj_field}"}
            pipeline.append({"$group": group_stage})

            final_project_stage_def = {"_id": 0, "tsm_name": "$_id.tsm_name", "activity_date": "$_id.activity_date", 
                                       "total_quantity": 1, "total_amount": 1, "number_of_sos": {"$size": "$number_of_sos"}}
            for total_field_name in summable_fields_in_projection.values():
                if total_field_name not in ["total_quantity", "total_amount"]:
                    final_project_stage_def[total_field_name] = 1
            pipeline.append({"$project": final_project_stage_def})
            self._add_search_filter_stages(pipeline, query_string, ["tsm_name", "activity_date"], column_filters)
        
        else:
            raise tornado.web.HTTPError(500, reason="Invalid report_type for export.")

        # Sorting (applied before fetching all data, no pagination for export)
        self._add_sorting_stage(pipeline, sort_by, sort_order)
        
        # Fetch all matching data
        results = await db[submission_collection_name].aggregate(pipeline).to_list(length=None) # Length None to get all
        return results, final_project_stage_def.get("$project", {}) if final_project_stage_def else {}


    def _write_csv(self, data, headers_map, filename_prefix):
        self.set_header('Content-Type', 'text/csv')
        self.set_header('Content-Disposition', f'attachment; filename="{filename_prefix}_{datetime.now().strftime("%Y%m%d")}.csv"')
        
        string_io = io.StringIO()
        # Use headers_map to define CSV headers in desired order and naming
        # If headers_map is empty (e.g. for TSM summary where keys are already good), derive from first data row
        if not data:
            self.write("No data to export.")
            return

        fieldnames = list(headers_map.keys()) if headers_map else list(data[0].keys())
        
        writer = csv.DictWriter(string_io, fieldnames=fieldnames, extrasaction='ignore')
        writer.writeheader() # Writes translated headers if headers_map is used, else original keys
        
        for row_dict in data:
            # If headers_map is provided, transform keys before writing
            if headers_map:
                transformed_row = {csv_header: row_dict.get(original_key, '') for csv_header, original_key in headers_map.items()}
                writer.writerow(transformed_row)
            else:
                writer.writerow(row_dict) # Write original dict if no specific header mapping
                
        self.write(string_io.getvalue())

    def _write_excel(self, data, headers_map, filename_prefix):
        self.set_header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        self.set_header('Content-Disposition', f'attachment; filename="{filename_prefix}_{datetime.now().strftime("%Y%m%d")}.xlsx"')
        
        excel_io = io.BytesIO()
        workbook = xlsxwriter.Workbook(excel_io, {'in_memory': True})
        worksheet = workbook.add_worksheet("Report")

        if not data:
            worksheet.write(0,0, "No data to export.")
            workbook.close()
            self.write(excel_io.getvalue())
            return

        # Use headers_map to define Excel headers in desired order and naming
        # If headers_map is empty, derive from first data row
        headers = list(headers_map.keys()) if headers_map else list(data[0].keys())
        original_keys = list(headers_map.values()) if headers_map else headers

        header_format = workbook.add_format({'bold': True, 'bg_color': '#D9D9D9', 'border': 1})
        for col_num, header_name in enumerate(headers):
            worksheet.write(0, col_num, header_name, header_format)

        for row_num, row_dict in enumerate(data, 1):
            for col_num, original_key in enumerate(original_keys):
                cell_value = row_dict.get(original_key, '')
                # Basic type handling for Excel
                if isinstance(cell_value, (datetime, date)):
                    date_format = workbook.add_format({'num_format': 'yyyy-mm-dd hh:mm:ss'})
                    worksheet.write_datetime(row_num, col_num, cell_value, date_format)
                elif isinstance(cell_value, (int, float)):
                    worksheet.write_number(row_num, col_num, cell_value)
                elif isinstance(cell_value, bool):
                    worksheet.write_boolean(row_num, col_num, cell_value)
                else: # String or other
                    worksheet.write_string(row_num, col_num, str(cell_value) if cell_value is not None else '')
        
        # Auto-adjust column widths (optional, can be slow for very wide tables)
        # for i, header in enumerate(headers):
        #    max_len = max(len(str(header)), *[len(str(row.get(original_keys[i], ''))) for row in data])
        #    worksheet.set_column(i, i, max_len + 2)

        workbook.close()
        self.write(excel_io.getvalue())


class SODetailExportHandler(BaseExportHandler):
    @authenticated_access(required_roles_any=[config.ROLE_WEBAPP_USER, config.ROLE_API_CLIENT])
    async def get(self):
        export_format = self.get_argument("format", None)
        if not export_format or export_format not in ["csv", "xlsx"]:
            raise tornado.web.HTTPError(400, reason="Invalid or missing 'format' parameter. Must be 'csv' or 'xlsx'.")

        data, projection_map = await self.generate_export_data(report_type='details')
        
        # For details export, the headers_map should come from the 'projection_map' ($project stage)
        # to match the structure of the data being exported and use user-friendly names.
        # The keys of projection_map are the output field names.
        # We need to decide if we use these directly or map them further.
        # For simplicity, let's use them directly if they are user-friendly enough.
        # If requested_fields was empty/*, projection_map might have many fields.
        # If specific fields were requested, projection_map keys reflect those.

        # Create a header map from the projection. Keys are output names, values are also output names (as they are already projected)
        # This assumes projection_map keys are the desired header names.
        # If a field like 'so_user_details.first_name' was projected as 'so_first_name',
        # projection_map would have {'so_first_name': '$so_user_details.first_name'}. We want 'so_first_name' as header.
        
        headers_for_export = {key: key for key in projection_map.keys() if key != "_id"} # Exclude MongoDB _id
        # If no specific fields were requested, and projection_map is complex,
        # one might need to derive headers from availableFields matching selected_fields.
        # For now, this assumes projection_map keys are good enough as headers.


        if export_format == "csv":
            self._write_csv(data, headers_for_export, "so_detail_report")
        elif export_format == "xlsx":
            self._write_excel(data, headers_for_export, "so_detail_report")


class TSMSummaryExportHandler(BaseExportHandler):
    @authenticated_access(required_roles_any=[config.ROLE_WEBAPP_USER, config.ROLE_API_CLIENT])
    async def get(self):
        export_format = self.get_argument("format", None)
        if not export_format or export_format not in ["csv", "xlsx"]:
            raise tornado.web.HTTPError(400, reason="Invalid or missing 'format' parameter. Must be 'csv' or 'xlsx'.")

        data, projection_map = await self.generate_export_data(report_type='tsm_summary')
        
        # For TSM summary, the projection_map keys from the final $project are already user-friendly
        # e.g., "tsm_name", "total_quantity".
        headers_for_export = {key: key for key in projection_map.keys() if key != "_id"}

        if export_format == "csv":
            self._write_csv(data, headers_for_export, "tsm_summary_report")
        elif export_format == "xlsx":
            self._write_excel(data, headers_for_export, "tsm_summary_report")


def make_app():
    app_settings = {
        "cookie_secret": config.COOKIE_SECRET,
        "login_url": "/api/v1/auth/login", 
        "debug": True 
    }
    return tornado.web.Application([
        (r"/api/v1/auth/login", LoginHandler),
        (r"/api/v1/auth/logout", LogoutHandler),
        (r"/api/v1/insights/so_daily_activity/available_fields", AvailableFieldsHandler),
        (r"/api/v1/insights/so_daily_activity/details", SODailyActivityDetailsHandler),
        (r"/api/v1/insights/so_daily_activity/tsm_summary", SODailyActivityTSMSummaryHandler),
        (r"/api/v1/insights/so_daily_activity/overall_summary", SODailyActivityOverallSummaryHandler),
        (r"/api/v1/insights/so_daily_activity/details/export", SODetailExportHandler),
        (r"/api/v1/insights/so_daily_activity/tsm_summary/export", TSMSummaryExportHandler),
    ], **app_settings)

if __name__ == "__main__":
    get_db() # Initialize DB connection and print status
    app = make_app()
    app.listen(8888)
    print("Application is running on port 8888")
    print(f"API Key Header: {config.API_KEY_HEADER}")
    print(f"Cookie Secret: {'SET' if config.COOKIE_SECRET != '__TODO:_GENERATE_YOUR_OWN_RANDOM_VALUE_HERE__' else 'NOT SET - PLEASE SET FOR PRODUCTION'}")

    # Example user/API key creation (run once or manage via a separate script)
    # Ensure you have `utils.py` in the same directory.
    # from utils import hash_password, generate_api_key
    # async def create_initial_data():
    #     db = get_db()
    #     # Create test webapp user if not exists
    #     if not await db.users.find_one({"username": "testuser"}):
    #         hashed_pw = hash_password("testpassword123")
    #         await db.users.insert_one({
    #             "username": "testuser", "hashed_password": hashed_pw,
    #             "roles": [config.ROLE_WEBAPP_USER, config.ROLE_ADMIN], "created_at": datetime.now(timezone.utc)
    #         })
    #         print("Created testuser with password 'testpassword123'")
        
    #     # Create test API key if no keys exist
    #     if await db.api_keys.count_documents({}) == 0:
    #         raw_key, hashed_api_key = generate_api_key()
    #         await db.api_keys.insert_one({
    #             "key_hash": hashed_api_key, "client_name": "default_test_client",
    #             "roles": [config.ROLE_API_CLIENT], "is_active": True,
    #             "created_at": datetime.now(timezone.utc)
    #         })
    #         print(f"Created test API key for 'default_test_client': {raw_key}")
    #         print("Store this key securely. It will not be shown again.")

    # tornado.ioloop.IOLoop.current().add_callback(create_initial_data) # Add data creation to IOLoop
    
    tornado.ioloop.IOLoop.current().start()
