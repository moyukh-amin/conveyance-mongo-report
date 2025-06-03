# SO Daily Activity Summary Insights Application

## 1. Overview

The SO Daily Activity Summary application provides a Business Intelligence (BI) interface for analyzing Sales Order (SO) activities. It offers detailed views, summaries by Territory Sales Manager (TSM), and overall daily summaries, all segmented by product type. The application features a dynamic interface allowing users to select columns for display and aggregation, and includes robust filtering, sorting, and data export capabilities. It supports both web application users (via session authentication) and programmatic API access (via API keys).

This repository contains the backend API built with Python (Tornado) and a frontend UI built with React (Ant Design).

## 2. Features

*   **Comprehensive Reporting:**
    *   **SO Detail View:** Granular, paginated, sortable, and filterable view of individual Sales Orders.
    *   **TSM Summary View:** Aggregated SO data (quantities, amounts, custom metrics) summarized by Territory Sales Manager, also paginated, sortable, and filterable.
    *   **Overall Daily Summary View:** High-level daily KPIs.
*   **Dynamic Data Presentation:** Users can select which columns (from SO form data and associated collections) to display in the SO Detail view and which numeric columns to aggregate in summaries.
*   **Product Type Segmentation:** All reports can be filtered by product type (e.g., "Combined", "Anbar", "Bobo").
*   **Hierarchical Reporting:** Option to use organizational hierarchy (SO -> TSM -> RM) for more accurate TSM/RM attributions in reports.
*   **Data Export:** Export SO Detail and TSM Summary reports to CSV and Excel (XLSX) formats, respecting active filters and sorts.
*   **Dual Authentication:**
    *   **Web Application:** Session-based authentication for UI users.
    *   **API Access:** API key-based authentication for programmatic access to insight endpoints.
*   **Contextual Help:** Integrated documentation links within the UI for SOPs and field explanations.
*   **Responsive UI:** Frontend built with Ant Design for a good user experience across devices.

## 3. Tech Stack

*   **Backend:**
    *   Python 3.9+
    *   Tornado (Asynchronous Web Framework)
    *   Motor (Asynchronous MongoDB Driver)
    *   MongoDB (NoSQL Database)
    *   Bcrypt (Password & API Key Hashing)
    *   XlsxWriter (Excel Export)
*   **Frontend:**
    *   React (JavaScript Library for UIs)
    *   Ant Design (UI Component Library)
    *   Axios (HTTP Client)
    *   React Context API (State Management)
    *   @ant-design/plots (Charting)
*   **Database:**
    *   MongoDB

## 4. Prerequisites

*   **Python:** Version 3.9 or higher.
*   **Node.js:** LTS version (e.g., 18.x or 20.x) for frontend development and build.
*   **MongoDB:** Version 4.x or higher. Ensure it's running and accessible.
*   **pip:** For Python package installation.
*   **npm** or **yarn:** For JavaScript package installation.

## 5. Project Structure

The project is logically divided into backend and frontend components. While the final structure might vary based on how the code was generated and organized, a typical monorepo or separate repo structure would look like:

```
/so-activity-summary-app/
|-- /backend/                 # Python Tornado backend application (app.py, utils.py, config.py)
|   |-- app.py                # Main application file with request handlers
|   |-- utils.py              # Hashing and utility functions
|   |-- config.py             # Backend configuration constants
|   |-- requirements.txt      # Backend Python dependencies (to be created)
|   |-- .env.example          # Example environment variables for backend
|
|-- /frontend/                # React frontend application (src/App.js, etc.)
|   |-- /public/
|   |-- /src/
|   |   |-- App.js
|   |   |-- index.js
|   |   |-- services/api.js
|   |   |-- components/
|   |   |-- contexts/
|   |   |-- config.js         # Frontend API base URL config
|   |-- package.json
|   |-- .env.example          # Example environment variables for frontend
|
|-- /docs/                    # Documentation files (if any, e.g., where this README might link)
|   |-- SO_Daily_Activity_Summary_Logic.md
|   |-- SO_Activity_Summary_Testing_Deployment_Guide.md
|
|-- README.md                 # This file
```
*(Note: `/backend` and `/frontend` are conceptual directories representing where the generated `app.py` and React `src/` folder would reside, respectively. `/docs` contains previously generated Markdown files.)*

## 6. Setup and Installation

### 6.1. Backend (Tornado)

1.  **Navigate to Backend Directory:**
    ```bash
    cd backend  # Or the directory containing app.py
    ```
2.  **Create and Activate Virtual Environment:**
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    ```
3.  **Create `requirements.txt`:**
    If not already present, create a `requirements.txt` file in the backend directory with the following content:
    ```txt
    tornado
    motor
    bcrypt
    xlsxwriter
    # Add any other specific versions if necessary, e.g., tornado==6.3.2
    ```
4.  **Install Dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
5.  **Configure Environment Variables:**
    *   Create a `.env` file in the backend directory (or set system environment variables).
    *   Refer to `backend/.env.example` suggestions in the "Configuration" section below.
    *   **Crucial:** Set a strong `COOKIE_SECRET` and a valid `MONGO_URI`.
6.  **Initial Data (Optional, for testing):**
    *   The backend `app.py` contains a commented-out section in its `if __name__ == "__main__":` block (`create_initial_data` function) to create a test user (`testuser`/`testpassword123`) and a test API key.
    *   To use this, ensure `utils.py` is in the same directory as `app.py`. Uncomment the relevant lines in `app.py`, run `python app.py` once, and then comment them out again. Note down the generated API key.

### 6.2. Frontend (React)

1.  **Navigate to Frontend Directory:**
    ```bash
    cd frontend  # Or the directory containing the React app's package.json
    ```
2.  **Install Dependencies:**
    ```bash
    npm install
    # or
    # yarn install
    ```
3.  **Configure Environment Variables:**
    *   Create a `.env` or `.env.local` file in the frontend directory.
    *   Refer to `frontend/.env.example` suggestions in the "Configuration" section below.
    *   Ensure `REACT_APP_API_BASE_URL` points to your running backend.

## 7. Configuration (using `.env` files)

Environment variables are used for configuration to avoid hardcoding sensitive information.

### 7.1. Backend (`backend/.env.example`)

Suggest creating a `.env` file in the `backend` directory:
```env
# backend/.env example
MONGO_URI="mongodb://localhost:27017/so_activity_db" # Full MongoDB connection string, replace so_activity_db with your DB name
COOKIE_SECRET="a_very_strong_and_random_secret_key_for_cookies_please_change_me" # CHANGE THIS!
API_KEY_HEADER="X-API-Key" # Default header name for API keys
LOG_LEVEL="INFO" # DEBUG, INFO, WARNING, ERROR
# For development with React dev server on port 3000:
CORS_ORIGINS="http://localhost:3000"
# For production, list specific frontend domains: "https://your-frontend.example.com,https://another-domain.com"
```
*(Note: The `app.py` currently uses `config.MONGO_DATABASE_URI.split('/')[-1].split('?')[0]` to infer DB name from URI or `client.get_default_database()`. So `MONGO_DB_NAME` is not strictly needed if DB name is in URI).*

### 7.2. Frontend (`frontend/.env.example`)

Suggest creating a `.env` or `.env.local` file in the `frontend` directory:
```env
# frontend/.env.example
REACT_APP_API_BASE_URL="http://localhost:8888/api/v1" # URL of your backend API
REACT_APP_DOCS_BASE_URL="https://your-wiki.example.com/sop" # Base URL for documentation links (update this)
```

## 8. Running the Application

### 8.1. Backend

1.  Ensure your MongoDB instance is running and accessible.
2.  Navigate to the `backend` directory (or where `app.py` is located).
3.  Activate the virtual environment: `source venv/bin/activate`.
4.  Load environment variables (if using a `.env` file and a library like `python-dotenv`, otherwise ensure they are set in your shell).
5.  Start the Tornado server:
    ```bash
    python app.py
    ```
    The backend will typically run on `http://localhost:8888`.

### 8.2. Frontend

1.  Navigate to the `frontend` directory.
2.  Start the React development server:
    ```bash
    npm start
    # or
    # yarn start
    ```
    The frontend will typically run on `http://localhost:3000` and open in your browser.

3.  **For Production Frontend Build:**
    ```bash
    npm run build
    # or
    # yarn build
    ```
    This creates an optimized static build in the `frontend/build` directory, which can then be served by a static web server like Nginx.

## 9. API Usage (for 3rd Party Integration)

Programmatic access to the insight APIs is available using API keys.

*   **Authentication:** Include your API key in the HTTP header specified by `API_KEY_HEADER` (default: `X-API-Key` in backend `config.py`).
    ```
    X-API-Key: YOUR_GENERATED_API_KEY
    ```
*   **Key Endpoints (refer to `app.py` for full list and parameters):**
    *   `GET /api/v1/insights/so_daily_activity/available_fields?form_id=<form_id>`: Get list of fields available for reports.
    *   `GET /api/v1/insights/so_daily_activity/details?date=<YYYY-MM-DD>&...`: Fetch detailed SO data.
    *   `GET /api/v1/insights/so_daily_activity/tsm_summary?date=<YYYY-MM-DD>&...`: Fetch TSM summary data.
    *   `GET /api/v1/insights/so_daily_activity/overall_summary?date=<YYYY-MM-DD>&...`: Fetch overall daily summary.
    *   `GET /api/v1/insights/so_daily_activity/details/export?format=<csv|xlsx>&date=<YYYY-MM-DD>&...`: Export SO Detail data.
    *   `GET /api/v1/insights/so_daily_activity/tsm_summary/export?format=<csv|xlsx>&date=<YYYY-MM-DD>&...`: Export TSM Summary data.

*   **API Key Management:** API keys (hashes) are stored in the `api_keys` MongoDB collection. Currently, key generation is manual (see `utils.py` or the `create_initial_data` example in `app.py`). A proper admin interface would be needed for production key management.
*   **Roles:** API keys are associated with roles (e.g., `api_client`). Access to endpoints is determined by these roles (see `authenticated_access` decorator in `app.py`).

## 10. Deployment

Deploying this application involves setting up the backend, frontend, and database in a production environment.

*   **Backend (Tornado):**
    *   Use a process manager like `systemd` or `supervisor` to run the Tornado application.
    *   Place a reverse proxy like Nginx in front of Tornado to handle SSL termination, serve static files (if any), and manage incoming connections.
    *   Ensure environment variables (especially `MONGO_URI`, `COOKIE_SECRET`) are securely configured.
    *   Configure CORS origins strictly.
*   **Frontend (React):**
    *   Build the application using `npm run build`.
    *   Serve the static files from the `build/` directory using Nginx or a dedicated static hosting service (e.g., AWS S3, Netlify, Vercel).
    *   Ensure `REACT_APP_API_BASE_URL` in the frontend build points to the production backend API URL.
*   **Database (MongoDB):**
    *   Ensure MongoDB is secured, with authentication enabled and network access restricted.
    *   Implement regular backups.
    *   Monitor performance and ensure necessary indexes are in place.

Refer to the `SO_Activity_Summary_Testing_Deployment_Guide.md` document (located in `/docs`) for a more detailed deployment checklist and testing guidelines.

## 11. Rate Limiting (Suggestions for Production)

For production environments, it's crucial to implement rate limiting on the API endpoints to prevent abuse and ensure fair usage.

*   **Strategies:**
    *   **Nginx:** Nginx's `limit_req_zone` and `limit_req` directives are highly effective for IP-based rate limiting.
    *   **Tornado Middleware/Decorator:** Custom middleware or decorators can be written in Tornado to implement more sophisticated rate limiting (e.g., per API key, per user session). This could involve using a store like Redis to track request counts.
*   **Types of Limits:**
    *   **Per IP Address:** Limit the number of requests an IP can make to sensitive endpoints (e.g., login, export) or overall API within a time window.
    *   **Per API Key:** If different clients have different usage tiers, apply limits based on the authenticated API key.
    *   **Per User Session:** For webapp users, limit actions like frequent report generations if necessary.
*   **Example (Conceptual Nginx):**
    ```nginx
    # In http block
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s; # 10 requests per second per IP for general API access
    limit_req_zone $binary_remote_addr zone=login_limit:10m rate=5r/m; # 5 requests per minute per IP for login

    # In server block
    location /api/v1/auth/login {
        limit_req zone=login_limit burst=5 nodelay;
        proxy_pass http://your_tornado_backend;
        # ... other proxy settings
    }

    location /api/v1/insights/ {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://your_tornado_backend;
        # ... other proxy settings
    }
    ```
*   **Considerations:**
    *   Clearly communicate rate limits to API users.
    *   Return appropriate HTTP 429 "Too Many Requests" responses when limits are exceeded.
    *   Allow higher limits for authenticated users/keys or specific trusted clients if necessary.

---

This README provides a comprehensive overview for the SO Daily Activity Summary application. Adapt and expand it as the project evolves.
