# SO Daily Activity Summary: Testing Guidelines & Deployment Checklist

## I. Testing Guidelines

This section outlines test strategies and example test cases for the 'SO Daily Activity Summary' application.

### 1. Backend API Testing

**Tools:** Postman, curl, or automated test frameworks (e.g., PyTest with `aiohttp.ClientSession` for Tornado).

#### 1.1. Authentication/Authorization

*   **Login (Success):**
    *   **Test Case:** POST to `/api/v1/auth/login` with valid `testuser` credentials.
    *   **Expected:** HTTP 200, JSON response with success message, `Set-Cookie` header for `user_id`.
*   **Login (Failure - Wrong Password):**
    *   **Test Case:** POST to `/api/v1/auth/login` with valid username, incorrect password.
    *   **Expected:** HTTP 401, JSON error message "Invalid username or password."
*   **Login (Failure - User Not Webapp Role):**
    *   **Test Case:** (Requires setup) Create a user without `webapp_user` role. Attempt login.
    *   **Expected:** HTTP 403, JSON error message "User not authorized for web application access."
*   **API Key Access (Success):**
    *   **Test Case:** GET request to an insights endpoint (e.g., `/api/v1/insights/so_daily_activity/available_fields?form_id=SO_FORM_ID`) with a valid API key in `X-API-Key` header.
    *   **Expected:** HTTP 200, valid JSON response.
*   **API Key Access (Failure - Invalid Key):**
    *   **Test Case:** GET request with an invalid/non-existent API key.
    *   **Expected:** HTTP 401, JSON error "Authentication required."
*   **API Key Access (Failure - Expired Key):**
    *   **Test Case:** (Requires setup) Set an API key's `expires_at` to the past. Attempt access.
    *   **Expected:** HTTP 401 (as expired keys are treated as invalid).
*   **API Key Access (Failure - Inactive Key):**
    *   **Test Case:** (Requires setup) Set an API key's `is_active` to `false`. Attempt access.
    *   **Expected:** HTTP 401.
*   **Role Protection (Conceptual - Webapp vs API):**
    *   **Test Case 1:** (If an endpoint was webapp-only) Attempt access with API key. Expected: 403.
    *   **Test Case 2:** (If an endpoint was API-only) Attempt access via webapp session. Expected: 403.
    *   *(Current implementation uses shared roles, so this is more for future expansion).*
*   **Role Protection (Specific Roles):**
    *   **Test Case:** (If an endpoint required `ROLE_ADMIN`) Attempt access as `testuser` (with `webapp_user` but not `admin`).
    *   **Expected:** HTTP 403, JSON error "Access denied. Requires one of roles: admin."

#### 1.2. `/api/v1/insights/so_daily_activity/available_fields` Endpoint

*   **Correct Response Structure:**
    *   **Test Case:** GET with valid `form_id=SO_FORM_ID`.
    *   **Expected:** HTTP 200, JSON response `{"available_fields": [...]}`. Each field object should have `name`, `label`, `type`, `source`.
*   **Dynamic Field Discovery (Associated Collection):**
    *   **Test Case:** (Requires setup) Ensure `custom_form_settings` for `SO_FORM_ID` has an `associated_with` collection defined (e.g., "tasks"). Populate "tasks" with a sample document.
    *   **Expected:** `available_fields` list should include fields from the "tasks" collection, correctly identified with `source: "tasks"`.
*   **Invalid `form_id`:**
    *   **Test Case:** GET with a `form_id` not in `custom_form_settings`.
    *   **Expected:** HTTP 404, "Form settings not found..."
*   **Missing `form_id`:**
    *   **Test Case:** GET without `form_id` parameter.
    *   **Expected:** HTTP 400, "Missing required parameter: form_id".

#### 1.3. `/details`, `/tsm_summary`, `/overall_summary` Endpoints

*   **Correct Data (Valid Parameters):**
    *   **Test Case:** For each endpoint, GET with a valid `date`, `product_type` ("Combined", "Anbar", "Bobo"), and a selection of `fields` (relevant for details and summary aggregations).
    *   **Expected:** HTTP 200. Data should match manually verifiable results from the database for the given filters.
        *   `/details`: Paginated list of SO records.
        *   `/tsm_summary`: Paginated list of TSM summaries.
        *   `/overall_summary`: Single object with overall totals.
*   **Accurate Aggregation (Summaries):**
    *   **Test Case:** For `/tsm_summary` and `/overall_summary`, verify `total_quantity`, `total_amount`, and any custom selected numeric field sums against manual DB aggregation.
    *   **Expected:** Aggregated values in the response must be correct.
*   **Server-Side Pagination (`/details`, `/tsm_summary`):**
    *   **Test Case 1:** Request with `page=1`, `page_size=5`. Expected: 5 items, correct pagination metadata.
    *   **Test Case 2:** Request with `page=2`, `page_size=5`. Expected: Next 5 items, correct pagination metadata.
    *   **Test Case 3:** Request with `page` exceeding total pages. Expected: Empty data array, correct pagination metadata.
*   **Server-Side Sorting (`/details`, `/tsm_summary`):**
    *   **Test Case:** Request with `sort_by=so_name` & `sort_order=asc`. Expected: Data sorted by SO name ascending.
    *   **Test Case:** Request with `sort_by=total_amount` & `sort_order=desc` (for TSM summary). Expected: Data sorted by total amount descending.
    *   **Test Case:** Invalid `sort_order`. Expected: HTTP 400.
*   **Global Search (`q`) (`/details`, `/tsm_summary`):**
    *   **Test Case:** Request with `q=SearchTerm` that should match specific records.
    *   **Expected:** Only records containing "SearchTerm" in the backend-defined searchable fields are returned.
*   **Per-Column Filters (`column_filter_*`) (`/details`, `/tsm_summary`):**
    *   **Test Case:** Request with `column_filter_so_name=John`. Expected: Only records where SO name starts with "John".
    *   **Test Case:** Combine multiple column filters. Expected: Records matching all filter criteria.
*   **`use_hierarchy` Functionality:**
    *   **Test Case (`/details` & `/tsm_summary`):** Request with `use_hierarchy=true` vs `use_hierarchy=false`.
    *   **Expected:**
        *   `true`: `tsm_name`, `rm_name` should be derived from `sub_orgs` traversal.
        *   `false`: `tsm_name`, `rm_name` should use fallback logic (e.g., `so_user_details.manager_name` or "N/A"). TSM summary grouping should reflect this.
*   **Error Handling (Invalid Parameters):**
    *   **Test Case (Date):** Invalid date format. Expected: HTTP 400.
    *   **Test Case (Pagination):** Non-integer `page`/`page_size`. Expected: HTTP 400.
    *   **Test Case (Product Type):** An unsupported product type. Expected: Might return empty data (valid) or specific error if designed that way.
*   **Empty Results:**
    *   **Test Case:** Use filters that result in no data.
    *   **Expected:** HTTP 200, empty data array `[]`, correct pagination metadata (`total_items: 0`).

#### 1.4. Export Endpoints (`.../export`)

*   **Valid CSV/XLSX Generation:**
    *   **Test Case:** For `/details/export` and `/tsm_summary/export`, request with `format=csv` and `format=xlsx`, including typical filter parameters (`date`, `product_type`, `fields`, `sort_by`, `q`, etc.).
    *   **Expected:** HTTP 200.
        *   `format=csv`: `Content-Type: text/csv`, valid CSV content.
        *   `format=xlsx`: `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, valid XLSX file.
*   **Correct Data in Exports:**
    *   **Test Case:** Verify exported file content against data fetched via JSON endpoints (with same filters, but without pagination for export).
    *   **Expected:** Data should match. All records (no pagination) should be present. Sorting and filtering should be applied.
*   **Correct Headers:**
    *   **Test Case:** Check column headers in CSV/XLSX.
    *   **Expected:** Headers should match the `fields` requested or the default projected fields.
*   **Invalid `format` Parameter:**
    *   **Test Case:** Request export with `format=pdf` or missing format.
    *   **Expected:** HTTP 400, error message about invalid format.

### 2. Frontend UI Testing (Manual/Exploratory Focus)

**Tools:** Web browser (Chrome, Firefox, Safari, Edge), Browser Developer Tools.

#### 2.1. Login/Logout Functionality

*   **Test Case (Login Success):** Enter valid `testuser` credentials. Expected: Redirect to report page, user info possibly displayed.
*   **Test Case (Login Failure):** Enter invalid credentials. Expected: Error message displayed on login form.
*   **Test Case (Logout):** Click logout button. Expected: Redirect to login page or clear user session state. Subsequent access to report page should fail or redirect to login.

#### 2.2. Filter Panel

*   **Date Selection:** Change date. Click "Apply Filters". Expected: Data in report tabs updates for the new date.
*   **Product Type Filtering:** Select "Anbar", "Bobo", "Combined". Click "Apply Filters". Expected: Data updates to reflect product type.
*   **`use_hierarchy` Switch:** Toggle switch. Click "Apply Filters". Expected: TSM/RM names in Detail tab and TSM Summary grouping should reflect the change.
*   **Dynamic Field Selector (`FieldSelector`):**
    *   **Populating:** Verify fields from `available_fields` (including associated collection fields if configured) are grouped and listed.
    *   **Selecting/Deselecting Fields:** Add/remove fields. Click "Apply Filters".
    *   **Expected (SO Detail):** Table columns update to show only selected fields.
    *   **Expected (Summaries):** If selected fields are numeric, their sums should appear in summary tables/charts after data fetch.

#### 2.3. Report Tabs

*   **Switching Tabs:** Click on "SO Detail", "TSM Summary", "Overall Summary" tabs.
*   **Expected:** Content updates to the correct report. Data is fetched/refreshed for the active tab based on current filters.

#### 2.4. SO Detail & TSM Summary Tables (`DynamicTable`)

*   **Correct Data Display:** Verify data matches applied filters and selected fields.
*   **Global Search:** Type search term in global search box. Expected: Table data filters to rows matching term across relevant columns.
*   **Per-Column Filtering:** Use column filter dropdowns. Expected: Table data filters based on column-specific criteria.
*   **Sorting:** Click column headers to sort. Expected: Data sorts ascending/descending for that column.
*   **Pagination Controls:**
    *   Change "items per page". Expected: Table updates to show correct number of items.
    *   Navigate to next/previous/specific page. Expected: Table displays correct data slice.

#### 2.5. Export Buttons

*   **SO Detail Tab:** With active filters/sorts/search, click "Export Data" -> "Export as CSV". Expected: CSV file downloads with correct data.
*   **SO Detail Tab:** Click "Export Data" -> "Export as Excel". Expected: XLSX file downloads.
*   **TSM Summary Tab:** Repeat export tests. Expected: Summary data exported correctly.

#### 2.6. Contextual Help Icons & FAQ Link

*   **Filter Panel Icons:** Click help icons next to "Use Hierarchy", "Select Columns". Expected: New browser tab opens with placeholder URL.
*   **Table Column Help Icons:** Click help icons in headers (e.g., "Amount" in SO Detail). Expected: New tab with placeholder URL.
*   **Overall Summary KPI Help:** Click help icons next to KPIs. Expected: New tab with placeholder URL.
*   **Header FAQ Link:** Click "Help / FAQ" in app header. Expected: New tab with placeholder URL.

#### 2.7. Responsiveness and Usability

*   **Browser Resize:** Resize browser window to simulate different screen sizes (desktop, tablet, mobile).
*   **Expected:** Layout adjusts gracefully. No major UI breakage. Tables might become horizontally scrollable.
*   **General Usability:** Controls are intuitive. Loading states are clear. Feedback is provided for actions.

#### 2.8. Error Handling

*   **API Errors:** (Simulate if possible, e.g., by stopping backend) Trigger an API error.
*   **Expected:** User-friendly error message displayed (e.g., Ant Design `message` or `Alert` component), not raw error details. Table shows error state.
*   **Invalid Frontend Input:** (e.g., if a free-text filter had validation)
*   **Expected:** Input validation messages.

### 3. Test Data Suggestions

*   **Empty Results:** Data for a date range or product type with no SOs.
*   **Standard Load:** A typical day's worth of data (e.g., 50-200 SOs, multiple TSMs).
*   **Large Results (Pagination/Export):** Data for a period with thousands of SOs to test pagination performance and export handling.
*   **Special Characters:** SO details, user names, TSM names with special characters (e.g., ` accented_names, symbols!@#`).
*   **Missing Associated Data:** SOs that link to an `associated_with` ID that doesn't exist in the associated collection.
*   **Hierarchy Variations:**
    *   SOs with no TSM/RM in `sub_orgs`.
    *   TSMs with no RM.
    *   Multiple levels of hierarchy if applicable.
*   **Field Variations:**
    *   Records with some `submitted_data` fields null or empty.
    *   Numeric fields with zero, positive, negative (if applicable) values.
*   **API Keys/Users:**
    *   Expired/inactive API keys.
    *   Users with different role combinations.

## II. Deployment Checklist

This checklist outlines key steps and considerations for deploying the 'SO Daily Activity Summary' application.

### 1. Backend (Tornado Application)

*   **[ ] Server Environment Setup:**
    *   Provision Linux VM (e.g., Ubuntu LTS) or prepare Docker container.
    *   System users and permissions configured.
*   **[ ] Python Version & Dependencies:**
    *   Install correct Python version (e.g., 3.9+).
    *   Create `requirements.txt` (include `tornado`, `motor`, `bcrypt`, `xlsxwriter`).
    *   Install dependencies: `pip install -r requirements.txt`.
*   **[ ] MongoDB Connection:**
    *   Set `MONGO_DATABASE_URI` environment variable (or config file securely).
    *   Ensure MongoDB user has appropriate read/write permissions for the application database.
    *   Verify network accessibility from Tornado server to MongoDB.
*   **[ ] Cookie Secret Key:**
    *   Set `COOKIE_SECRET` environment variable to a strong, random string. **DO NOT use the default.**
*   **[ ] API Key Header Name:**
    *   Verify `API_KEY_HEADER` in `config.py` (default `X-API-Key`) is suitable.
*   **[ ] Process Manager:**
    *   Configure `systemd` service or `supervisor` process for the Tornado application.
    *   Ensure auto-restart on failure and startup on boot.
    *   Run Tornado on a non-privileged port (e.g., 8888, 8000).
*   **[ ] Reverse Proxy (Nginx/Apache):**
    *   Install and configure Nginx (recommended) or Apache.
    *   **Proxy to Tornado:** Configure Nginx to proxy requests to the Tornado application's port (e.g., `proxy_pass http://127.0.0.1:8888;`).
    *   Set necessary proxy headers (`X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`).
    *   **SSL/HTTPS Setup:** Obtain and configure SSL certificate (e.g., Let's Encrypt). Enforce HTTPS.
    *   **Static Files (If any served by Tornado):** Configure Nginx to serve them directly for better performance (not applicable if frontend is fully separate).
*   **[ ] CORS Configuration:**
    *   In `app.py`'s `BaseHandler.set_default_headers`, change `Access-Control-Allow-Origin` from `"*"` to the specific frontend domain(s) in production.
*   **[ ] Logging:**
    *   Configure Tornado's logging options (or use process manager's logging) to output to files.
    *   Set up log rotation.
    *   Consider structured logging for easier parsing.

### 2. Frontend (React Application)

*   **[ ] Node.js Environment:**
    *   Install Node.js (LTS version recommended) on a build machine or CI/CD environment.
*   **[ ] Production Build:**
    *   Run `npm run build` (or `yarn build`) to create optimized static assets in the `build` folder.
*   **[ ] Static Asset Hosting:**
    *   Choose and configure a hosting strategy:
        *   **Nginx:** Serve the `build` directory contents from the same server as the backend (or a dedicated web server). Configure Nginx to serve `index.html` for SPA routing.
        *   **Cloud Storage (S3/GCS):** Upload `build` contents to a bucket.
        *   **CDN (CloudFront/Cloudflare):** Serve assets from CDN edge locations for performance, often with S3 as origin.
        *   **Platform (Netlify/Vercel):** Deploy directly from Git repository.
*   **[ ] API Base URL Configuration:**
    *   In `src/config.js`, ensure `API_BASE_URL` points to the correct production backend URL (e.g., `https://your-api.example.com/api/v1/insights`). This might be managed via environment variables injected at build time.
*   **[ ] Documentation Base URL Configuration:**
    *   In `src/config.js`, update `DOCS_BASE_URL` to the actual production documentation/wiki URL.

### 3. Database (MongoDB)

*   **[ ] Accessibility & Security:**
    *   Ensure MongoDB is running and accessible only from allowed IPs (e.g., backend server IP).
    *   Authentication enabled with strong credentials.
    *   TLS/SSL encryption for connections to MongoDB if over untrusted networks.
*   **[ ] Backups:**
    *   Implement and test a regular backup strategy for MongoDB (e.g., `mongodump`, cloud provider snapshots).
*   **[ ] Indexes:**
    *   Verify critical indexes are in place:
        *   `users`: `username` (unique)
        *   `api_keys`: `key_hash` (if direct lookup was feasible, otherwise less critical for bcrypt iteration), `client_name`
        *   `custom_form_settings`: `form_id` (unique)
        *   `dynamic submission collections`: `created_at`, `status`, `submitted_data.product_type`, `created_by`, `associated_with` (if frequently queried).
        *   `sub_orgs`: `user_id`, `parent_org_id`.
    *   Analyze query patterns and add more indexes as needed for performance.

### 4. General

*   **[ ] Domain Name & DNS:**
    *   Configure DNS records (A, AAAA, CNAME) for the backend API and frontend application.
*   **[ ] Environment Variables Management:**
    *   Use environment variables for sensitive configurations (DB URI, secrets, API URLs).
    *   Utilize `.env` files (not committed to Git for production secrets) or a configuration management system.
*   **[ ] Backup Strategy (Application):**
    *   Regular backups of application code, configuration files, and Nginx configs. Version control (Git) is primary for code.
*   **[ ] Monitoring:**
    *   **Basic Health Checks:** Setup uptime monitoring for API and frontend URLs.
    *   **Resource Usage:** Monitor server CPU, memory, disk, network usage.
    *   **Application Performance Monitoring (APM):** (Optional, advanced) Tools like Sentry, Datadog for error tracking and performance insights.
    *   **Log Monitoring:** Centralized logging (e.g., ELK stack, Grafana Loki) for easier troubleshooting.
*   **[ ] Initial Data Setup (Users/API Keys):**
    *   Securely create initial admin users and any necessary API keys for external services or clients. Use the `utils.py` script or a dedicated admin interface if built.
*   **[ ] Final Testing (Staging/Production):**
    *   Perform smoke tests on the deployed production environment.
    *   Verify all critical paths and integrations.

This comprehensive checklist should guide the deployment process effectively.The "SO_Activity_Summary_Testing_Deployment_Guide.md" document has been successfully created.

It includes:

*   **I. Testing Guidelines:**
    *   **Backend API Testing:** Covers authentication/authorization, `/available_fields`, data endpoints (`/details`, `/tsm_summary`, `/overall_summary`) with checks for data correctness, aggregation, pagination, sorting, filtering, `use_hierarchy`, and error handling. Also includes tests for `/export` endpoints (CSV/XLSX generation, data correctness, headers).
    *   **Frontend UI Testing:** Focuses on manual/exploratory testing of login/logout, filter panel interactions, report tab functionality, dynamic table operations (data display, search, filter, sort, pagination), export button triggers, contextual help links, responsiveness, and error display.
    *   **Test Data Suggestions:** Provides ideas for various data scenarios to ensure comprehensive testing.

*   **II. Deployment Checklist:**
    *   **Backend (Tornado):** Details server setup, Python environment, MongoDB connection, security configurations (cookie secret, API key header), process management, reverse proxy (Nginx) setup including SSL, CORS, and logging.
    *   **Frontend (React):** Covers Node.js build environment, production build, static asset hosting strategies, and configuration of API and documentation URLs.
    *   **Database (MongoDB):** Emphasizes accessibility, security, backups, and the importance of indexes.
    *   **General:** Includes DNS, environment variable management, application backup, and monitoring setup.

This document provides a solid framework for testing the application thoroughly and deploying it systematically.
