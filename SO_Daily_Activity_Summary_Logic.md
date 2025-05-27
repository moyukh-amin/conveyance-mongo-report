# Conceptual Data Aggregation and Processing Logic: SO Daily Activity Summary Report

## 1. Objective

The primary objective is to generate the 'SO Daily Activity Summary' report. This report provides insights into daily sales activities and is presented in three distinct views:

*   **SO Detail:** Granular data for each Sales Order (SO), with dynamically selectable columns.
*   **TSM Summary:** Aggregated data summarized by Territory Sales Manager (TSM).
*   **Total Daily Summary:** A high-level daily summary of all activities.

Each of these views is further segmented by Product Type: Combined (all products), Anbar, and Bobo. The report allows users to select additional columns from related data sources for inclusion in the detail view and for aggregation in summary views.

## 2. Data Sources

The following MongoDB collections are utilized to generate the report:

*   **`custom_form_settings`**:
    *   **Role:** Stores metadata about custom forms. Key fields include:
        *   `form_id`: Identifier for the form (e.g., "SO_FORM_ID").
        *   `collection_name`: The name of the MongoDB collection where submissions for this form are stored (e.g., `custom_form_submissions_xxxxxxxx`).
        *   `associated_with`: (Optional) Specifies the **name of another collection** (e.g., "tasks", "products", "campaigns") that submissions can be linked to. This enables fetching additional related data.
        *   `fields`: An array or object describing the fields in the form, which helps in identifying available fields for selection.
*   **`dynamic submission collection`** (e.g., `custom_form_submissions_xxxxxxxx`):
    *   **Role:** Contains the actual SO submission data. The specific collection name is dynamically determined by looking up the `collection_name` in `custom_form_settings`. Each document represents a single SO and includes:
        *   `submitted_data`: An object holding the raw form inputs.
        *   `created_by`: User ID of the SO creator.
        *   `created_at`: Submission timestamp.
        *   `associated_with`: (Optional) An **ObjectID or identifier** that links this submission to a specific document in the collection named by `custom_form_settings.associated_with`. For example, if `custom_form_settings.associated_with` is "tasks", this field might hold the `_id` of a document in the `tasks` collection.
*   **`users`**:
    *   **Role:** Stores user information. Used to enrich SO data with details about the creator of the SO (the Sales Officer or "SO") and potentially other users involved in the hierarchy (TSM, RM). Key fields include `_id`, `first_name`, `last_name`, and `employee_id`.
*   **`sub_orgs`**:
    *   **Role:** Stores organizational hierarchy information. Key for Phase 3, enabling hierarchical reporting by linking users to their respective sub-organizations and identifying their managers.
*   **`Associated Collection`** (Dynamic, e.g., `tasks`, `products`):
    *   **Role:** This is not a single, fixed collection but rather refers to the collection specified by `custom_form_settings.associated_with`. It contains additional details that can be pulled into the report. The schema of this collection determines which extra fields can be selected by the user.

## 3. Discovering Available Fields for User Selection

Before generating the report, the system must determine the list of fields available for user selection. This involves:

1.  **Inspecting `custom_form_settings` for the "SO_FORM_ID":**
    *   Identify the primary `collection_name` for SO submissions.
    *   Extract the list of fields defined within `submitted_data` from the `fields` property in `custom_form_settings`. These are the base fields from the SO form itself.
2.  **Checking for an `associated_with` Collection:**
    *   If `custom_form_settings.associated_with` is defined, this indicates an additional related collection (e.g., "tasks").
3.  **Inspecting the Schema of the `Associated Collection`:**
    *   The system needs to determine the fields available in this associated collection. This might be done by:
        *   Querying a sample document from the associated collection.
        *   Referring to a predefined schema mapping for known associated collections.
        *   Analyzing `custom_form_settings` for the form that populates the associated collection (if such a setting exists).
4.  **Presenting Fields to User:**
    *   The combined list of fields (from `submitted_data` and the `Associated Collection`) is presented to the user for selection. The user can choose which of these fields they want to see in the "SO Detail" view and which numeric fields they want aggregated in the summary views.

## 4. Phase 1: Building 'Base_SO_Activity_Data'

This foundational phase involves fetching, cleaning, preparing, and enriching the raw SO data with data from associated collections based on user selections.

**Steps & Conceptual MongoDB Aggregation Stages:**

*   **Target Date Calculation & Source Collection Identification:** (As previously defined)

*   **Aggregation Stage 1: Initial `$match` & `$project` (on the dynamic submission collection):**
    *   **`$match`**: (As previously defined - by date, status)
    *   **`$project`**:
        *   Expose necessary base fields from `submitted_data` (e.g., `product_type`, `quantity`, `amount`).
        *   Include `created_by`, `created_at`.
        *   Include the `associated_with` ID field (e.g., `associated_task_id: "$associated_with"`) if present, for the subsequent lookup.
        *   Rename fields for clarity.

    ```javascript
    // Conceptual Example
    [
      // ... $match stage ...
      {
        $project: {
          _id: 1,
          so_creator_id: "$created_by",
          submission_date_raw: "$created_at",
          product_type_raw: "$submitted_data.product_type",
          quantity_raw: "$submitted_data.quantity",
          amount_raw: "$submitted_data.amount",
          associated_item_id: "$associated_with", // ID for lookup to associated collection
          // ... other core fields from submitted_data
        }
      }
    ]
    ```

*   **Aggregation Stage 2: `$lookup` for Users (SO Creator):** (As previously defined)

*   **Aggregation Stage 3: Conditional `$lookup` for 'Associated Collection' Data:**
    *   This stage is conditional based on whether `custom_form_settings.associated_with` is defined and if the user selected any fields from this associated collection.
    *   **`$lookup`**:
        *   `from`: The collection name retrieved from `custom_form_settings.associated_with` (e.g., "tasks"). This needs to be dynamically set in the aggregation pipeline.
        *   `localField`: `associated_item_id` (from previous projection).
        *   `foreignField`: `_id` (typically).
        *   `as`: `associated_data_docs`.
    *   **`$unwind`**:
        *   `path`: `$associated_data_docs`.
        *   `preserveNullAndEmptyArrays`: `true` (to keep SO records even if the associated document is missing).

    ```javascript
    // Conceptual Example (Continuing from above)
    [
      // ... previous stages ...
      {
        $lookup: {
          from: "tasks", // This would be dynamically set based on form settings
          localField: "associated_item_id",
          foreignField: "_id",
          as: "associated_data_docs"
        }
      },
      {
        $unwind: { path: "$associated_data_docs", preserveNullAndEmptyArrays: true }
      }
    ]
    ```

*   **Aggregation Stage 4: Hierarchical Lookups (TSM/RM):** (As defined in previous Phase 3, now part of the extended Phase 1)
    *   This involves `$lookup` stages with `sub_orgs` and `users` to fetch TSM and RM details.

*   **Aggregation Stage 5: Dynamic Final `$project`:**
    *   This stage is crucial and **dynamic** based on user selections.
    *   **Core Fields:** Always include essential fields like `activity_date`, `so_id`, `so_name`, `product_type`, `tsm_name`, `rm_name`.
    *   **Submission Data Fields:**
        *   Include fields selected by the user from `submitted_data`.
        *   Perform type conversions (e.g., to number for `quantity`, `amount`) with error handling (`$ifNull`, `$convert`).
    *   **Associated Collection Fields:**
        *   Include fields selected by the user from `associated_data_docs`.
        *   Perform type conversions for any numeric fields selected from the associated collection, with error handling.
        *   Example: `selected_associated_field: { $ifNull: [ "$associated_data_docs.some_field_chosen_by_user", "N/A" ] }`
        *   Example (numeric): `associated_numeric_field: { $ifNull: [ { $convert: { input: "$associated_data_docs.numeric_field_chosen_by_user", to: "double", onError: 0.0, onNull: 0.0 } }, 0.0 ] }`

    ```javascript
    // Conceptual Example (Continuing from above)
    [
      // ... previous stages including TSM/RM lookups ...
      {
        $project: {
          _id: 1, // SO Submission ID
          activity_date: { $dateToString: { format: "%Y-%m-%d", date: "$submission_date_raw" } },
          so_id: "$so_user_details.employee_id",
          so_name: { $concat: ["$so_user_details.first_name", " ", "$so_user_details.last_name"] },
          tsm_name: /* from TSM lookup */,
          rm_name: /* from RM lookup */,
          product_type: "$product_type_raw",
          quantity: { $ifNull: [ { $convert: { input: "$quantity_raw", to: "double", onError: 0.0, onNull: 0.0 } }, 0.0 ] },
          amount: { $ifNull: [ { $convert: { input: "$amount_raw", to: "double", onError: 0.0, onNull: 0.0 } }, 0.0 ] },

          // Dynamically included based on user selection:
          // Example from submitted_data:
          // custom_field_from_so: "$submitted_data.user_selected_field_from_form",
          // Example from associated collection:
          // task_code: { $ifNull: [ "$associated_data_docs.task_code_field", "N/A" ] },
          // associated_value: { $ifNull: [ { $convert: { input: "$associated_data_docs.some_numeric_value", to: "double", onError: 0.0, onNull: 0.0 } }, 0.0 ] }
        }
      }
    ]
    // Resulting documents are 'Base_SO_Activity_Data'
    ```

## 5. Phase 2: Generating Specific Report Views (from 'Base_SO_Activity_Data')

This phase takes the dynamically structured `Base_SO_Activity_Data` and applies further aggregation for different report views.

*   **SO Detail Report Views (Combined, Anbar, Bobo):**
    *   **Logic:** This view is the most granular. It's essentially the `Base_SO_Activity_Data` (which now includes user-selected fields from both the submission and associated collection) with an additional product filter.
    *   **Pipeline Steps (appended to Phase 1 pipeline):**
        1.  **`$match` (for Product Type):** (As previously defined)
    *   The output fields are dynamic, based on the user's selections in Phase 1.

*   **TSM Summary Report Views (Combined, Anbar, Bobo):**
    *   **Logic:** Aggregates the SO Detail data at the TSM level for a given date.
    *   **Pipeline Steps (appended to the product-filtered SO Detail pipeline):**
        1.  **`$match` (for Product Type):** (As previously defined)
        2.  **`$group`:**
            *   `_id`: `{ tsm_name: "$tsm_name", activity_date: "$activity_date" }`.
            *   **Dynamic Aggregations:** For each *numeric* field selected by the user (whether from `submitted_data` like `quantity`, `amount`, or from the `Associated Collection`), include a sum.
                *   `total_quantity: { $sum: "$quantity" }`
                *   `total_amount: { $sum: "$amount" }`
                *   `total_custom_numeric_from_so: { $sum: "$custom_numeric_from_so" }` (if selected and numeric)
                *   `total_associated_numeric_field: { $sum: "$associated_numeric_field" }` (if selected and numeric)
            *   `so_count`: `{ $addToSet: "$so_id" }`
        3.  **`$project`:**
            *   `_id: 0`
            *   `tsm_name: "$_id.tsm_name"`
            *   `activity_date: "$_id.activity_date"`
            *   `number_of_sos: { $size: "$so_count" }`
            *   Include all the summed fields (e.g., `total_quantity`, `total_amount`, `total_custom_numeric_from_so`, `total_associated_numeric_field`).

    ```javascript
    // Conceptual Example for TSM Summary (e.g., Anbar)
    [
      // ... (Phase 1 pipeline stages, including dynamic fields) ...
      { $match: { product_type: "Anbar" } }, // Product filter
      {
        $group: {
          _id: { tsm_name: "$tsm_name", activity_date: "$activity_date" },
          total_quantity: { $sum: "$quantity" },
          total_amount: { $sum: "$amount" },
          // total_user_selected_numeric1: { $sum: "$user_selected_numeric1" }, // From SO or Associated
          // total_user_selected_numeric2: { $sum: "$user_selected_numeric2" }  // From SO or Associated
        }
      },
      {
        $project: { /* ... project the grouped fields ... */ }
      }
    ]
    ```

*   **Total Daily Summary Views (Combined, Anbar, Bobo):**
    *   **Logic:** Aggregates all SO data for a given date.
    *   **Pipeline Steps:**
        1.  **`$match` (for Product Type):** (As previously defined)
        2.  **`$group`:**
            *   `_id`: `{ activity_date: "$activity_date" }`.
            *   **Dynamic Aggregations:** Similar to TSM summary, sum all user-selected *numeric* fields.
                *   `overall_total_quantity`: `{ $sum: "$quantity" }`
                *   `overall_total_amount`: `{ $sum: "$amount" }`
                *   `overall_total_custom_numeric_from_so: { $sum: "$custom_numeric_from_so" }`
                *   `overall_total_associated_numeric_field: { $sum: "$associated_numeric_field" }`
        3.  **`$project`:**
            *   `_id: 0`
            *   `activity_date: "$_id.activity_date"`
            *   Include all the summed fields.

## 6. Phase 3: Hierarchical Reporting (Integrated into Phase 1)

The logic for fetching TSM/RM names using `sub_orgs` (previously described as Phase 3) is now integrated as Aggregation Stage 4 within Phase 1. This ensures that `Base_SO_Activity_Data` is fully enriched before Phase 2 views are generated.

## 7. Key Output Fields (Now More Dynamic)

The fields present in the final reports are more dynamic due to user selection.

*   **SO Detail Report Views:**
    *   **Core:** `activity_date`, `so_id`, `so_name`, `product_type`, `tsm_name`, `rm_name`.
    *   **Standard Numeric:** `quantity`, `amount`.
    *   **User-Selected:** Any additional fields chosen by the user from the SO's `submitted_data` or from the `Associated Collection`.

*   **TSM Summary Report Views:**
    *   **Core:** `activity_date`, `tsm_name`, `number_of_sos`.
    *   **Aggregated Numeric:** `total_quantity`, `total_amount`, and sums of any other *numeric* fields selected by the user (from SO or Associated Collection).

*   **Total Daily Summary Views:**
    *   **Core:** `activity_date`.
    *   **Aggregated Numeric:** `overall_total_quantity`, `overall_total_amount`, and sums of any other *numeric* fields selected by the user.

This document provides a conceptual framework. Actual MongoDB aggregation pipelines will be dynamically constructed based on user selections and the specific schemas involved.
