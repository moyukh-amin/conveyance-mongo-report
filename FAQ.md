# SO Daily Activity Summary - Frequently Asked Questions (FAQ)

This FAQ provides answers to common questions about the SO Daily Activity Summary application.

## 1. General

**Q1: What is the purpose of the SO Daily Activity Summary application?**
A1: This application provides a Business Intelligence (BI) interface to view, analyze, and export Sales Order (SO) activity data. It helps users understand daily sales performance through detailed order information, summaries by Territory Sales Manager (TSM), and overall daily totals.

**Q2: Who is this application for?**
A2: This application is primarily for sales managers, operations teams, business analysts, and any personnel involved in monitoring and analyzing sales performance. It also provides API access for programmatic data retrieval by other systems or developers.

## 2. Using the App

**Q3: How do I use the date filter?**
A3: In the "Filters & Report Configuration" panel, click on the date input field. A calendar will appear, allowing you to select a specific date. The reports will then load data for the chosen date after you click the "Apply Filters & Fetch Data" button.

**Q4: How do I filter by Product Type?**
A4: Use the "Product Type" dropdown in the filter panel. You can select "All Product Types" (Combined), "Anbar", or "Bobo". After selection, click "Apply Filters & Fetch Data" to update the reports.

**Q5: What is the "Select Columns" dropdown for?**
A5: This dropdown allows you to customize the information displayed:
    *   **SO Detail Tab:** Choose which columns (fields from the Sales Order form or related data) appear in the SO Detail table.
    *   **TSM & Overall Summaries:** If you select numeric fields here (e.g., "custom_metric_value" from your SO form), these fields will also be summed up and displayed in the TSM Summary and Overall Daily Summary views. Standard metrics like "Quantity" and "Amount" are usually always included in summaries.
    Click the "Apply Filters & Fetch Data" button after making your selections.

**Q6: What does the "Use Hierarchy" switch do?**
A6: The "Use Hierarchy" switch (primarily relevant for TSM Summary and TSM/RM names in SO Detail) determines how Territory Sales Manager (TSM) and Regional Manager (RM) information is derived:
    *   **On (Checked):** The system uses the defined organizational structure (often in a `sub_orgs` collection) to find the TSM and RM for each Sales Officer. This is generally more accurate if the hierarchy data is well-maintained.
    *   **Off (Unchecked):** The system might use simpler, direct manager information if available on the Sales Officer's user record, or show "N/A".
    Click the help icon next to the switch for a link to more detailed SOPs.

**Q7: Can you explain the different report tabs?**
A7:
    *   **SO Detail Tab:** Shows a detailed, paginated table of individual Sales Orders matching your filter criteria. You can sort, filter columns, and perform a global search on this data.
    *   **TSM Summary Tab:** Aggregates the SO data by Territory Sales Manager (TSM) for the selected date and filters. It shows total quantities, amounts, number of SOs, and sums of any other numeric fields you selected. This tab also includes a chart for visual comparison.
    *   **Overall Daily Summary Tab:** Displays key performance indicators (KPIs) for the total activity on the selected date, such as overall total quantity and amount.

**Q8: How do I export data?**
A8: On the "SO Detail" and "TSM Summary" tabs, you will find an "Export Data" (or similar) button, usually near the top of the table. Clicking this button will reveal options to export the current view's data (respecting all active filters, search terms, and sorting) as a CSV or Excel (XLSX) file. The "Overall Daily Summary" tab typically does not have an export feature as it displays KPIs directly.

**Q9: How do I use search, sort, and pagination in the tables?**
A9:
    *   **Global Search:** Above the tables in "SO Detail" and "TSM Summary" tabs, there's a search box. Type your search term and press Enter or click the search icon to filter data across relevant columns.
    *   **Column Sorting:** Click on a column header to sort the data by that column. Click again to toggle between ascending and descending order.
    *   **Column Filtering:** Some columns may have a filter icon in their header. Click it to open a dropdown where you can enter values to filter that specific column.
    *   **Pagination:** At the bottom of the tables, you'll find pagination controls to navigate through pages of data and change the number of items displayed per page.

## 3. Data & Metrics

**Q10: Where does the data in this application come from?**
A10: The data is primarily sourced from your organization's Sales Order submission system, which stores data in a MongoDB database. This includes collections for SO form submissions (`custom_form_submissions_...`), user details (`users`), organizational hierarchy (`sub_orgs`), and form configurations (`custom_form_settings`). It may also pull data from other related collections if configured (e.g., a "tasks" or "products" collection via the `associated_with` feature).

**Q11: How up-to-date is the data? / How often is it refreshed?**
A11: The data displayed is fetched directly from the operational database in real-time when you apply filters or switch tabs. Therefore, it reflects the most current data available in the source systems at the moment of your query. There isn't a separate data warehousing or batch update process for this specific application.

**Q12: Can you explain [Key Metric X]? (e.g., "Total Amount")**
A12:
    *   **General Approach:** For specific metrics, detailed explanations (SOPs) are often linked directly in the UI via help icons (e.g., a small `?` or `i` icon next to a column header or KPI). Please click these icons for contextual information.
    *   **Example - "Total Amount" (TSM Summary):** This typically represents the sum of the "Amount" field from all approved Sales Orders created on the selected date by Sales Officers reporting to that TSM, filtered by the selected Product Type. The exact calculation logic is defined in the backend aggregation pipeline.
    *   **Example - "Quantity" (SO Detail):** This is usually the quantity of the product specified in that particular Sales Order line item.

## 4. Account & Access

**Q13: How do I log in to the application?**
A13: Navigate to the application's URL. You should be presented with a login page. Enter your assigned username and password and click "Login".

**Q14: What if I can't log in or forgot my password?**
A14:
    *   Ensure you are using the correct username and password. Check for typos and case sensitivity.
    *   If you have forgotten your password or continue to have issues, please contact your system administrator or IT support team for assistance with password resets or account issues.

**Q15: How can I get API access if I need to pull data programmatically?**
A15: API access requires an API key. To request an API key and get information on appropriate API roles, please contact your system administrator or the team responsible for managing this application. They will be able to generate a key for you and provide details on its usage.

## 5. Troubleshooting

**Q16: The data is not loading, or the page seems stuck. What should I do?**
A16:
    1.  **Check your internet connection.**
    2.  **Try refreshing the page** (Ctrl+R or Cmd+R).
    3.  **Clear your browser cache and cookies** for this site, then try again.
    4.  **Check the filter panel:** Ensure you have selected a valid date and clicked "Apply Filters & Fetch Data".
    5.  If the problem persists, there might be an issue with the backend services or the database. Please contact your IT support team.

**Q17: I clicked "Export Data", but the file didn't download or is corrupted.**
A17:
    1.  Ensure you have a stable internet connection during the download.
    2.  Try exporting again.
    3.  If you have many filters applied or are exporting a very large dataset, the request might time out. Try reducing the complexity of your filters or selecting a smaller date range (if applicable for the report type).
    4.  Ensure your browser doesn't have pop-up blockers that might interfere with file downloads (though direct downloads are usually fine).
    5.  If the issue continues, report it to your IT support team, noting the filters you had applied.

**Q18: A help link (e.g., `?` icon) is not working or goes to the wrong page.**
A18: Please report this to your system administrator or the application support team. Provide details about which help icon/link you clicked and what happened. The documentation URLs might need updating.

## 6. Technical (for Admins/Developers - Brief)

**Q19: What are the key configuration files/variables I should be aware of for the backend?**
A19:
    *   **`.env` file (in the backend directory):** This is the primary place for instance-specific configuration.
        *   `MONGO_URI`: The MongoDB connection string.
        *   `COOKIE_SECRET`: Essential for secure user sessions. **Must be changed for production.**
        *   `API_KEY_HEADER`: Name of the HTTP header used for API key authentication.
        *   `CORS_ORIGINS`: Whitelist of frontend domains allowed to access the API.
    *   **`config.py`:** Contains more static configurations and default values.

**Q20: How do I restart the backend or frontend services (conceptually)?**
A20:
    *   **Backend (Tornado):** If running via a process manager like `systemd` or `supervisor`:
        *   `sudo systemctl restart your-tornado-service-name`
        *   `sudo supervisorctl restart your-tornado-process-name`
        If running directly with `python app.py` (for development), stop it with Ctrl+C and restart.
    *   **Frontend (React Development Server):** Stop it with Ctrl+C in the terminal where `npm start` or `yarn start` was run, then restart.
    *   **Frontend (Production Static Build):** This doesn't involve "restarting" the frontend app itself, but you might need to:
        *   Clear CDN caches if a CDN is used.
        *   Restart or reload the webserver (e.g., Nginx) if it's serving the static files and its configuration changed: `sudo systemctl reload nginx`.

---
If your question is not answered here, please contact your system administrator or the designated support team for this application.
