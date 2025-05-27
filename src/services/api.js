// src/services/api.js
import axios from 'axios';
import API_BASE_URL from '../config';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to handle errors (optional, but good practice)
apiClient.interceptors.response.use(
  response => response,
  error => {
    // Log error or show user-friendly message
    console.error('API call error:', error.response || error.message || error);
    return Promise.reject(error.response || error); // Return response for components to handle
  }
);

export const getAvailableFields = (formId = 'SO_FORM_ID') => {
  return apiClient.get('/so_daily_activity/available_fields', {
    params: { form_id: formId },
  });
};

export const getSODetails = (params) => {
  // Params example:
  // {
  //   date: 'YYYY-MM-DD',
  //   product_type: 'Anbar' | 'Bobo' | 'Combined',
  //   fields: 'field1,field2,submitted_data.custom_field', // comma-separated
  //   page: 1,
  //   page_size: 10,
  //   sort_by: 'so_name',
  //   sort_order: 'asc' | 'desc',
  //   q: 'searchText', // global search
  //   column_filter_fieldName: 'filterValue', // e.g. column_filter_so_name: 'John'
  //   use_hierarchy: true | false
  // }
  return apiClient.get('/so_daily_activity/details', { params });
};

export const getTSMSummary = (params) => {
  // Params similar to getSODetails, 'fields' here would be numeric fields to sum
  return apiClient.get('/so_daily_activity/tsm_summary', { params });
};

export const getOverallSummary = (params) => {
  // Params: date, product_type, fields (numeric fields to sum)
  return apiClient.get('/so_daily_activity/overall_summary', { params });
};


// --- Export URL Construction ---
// These functions construct the URL for file download.
// The actual download is typically triggered by window.location.href = url;
// The `params` object should be the same as for getSODetails or getTSMSummary,
// plus a `format` field ('csv' or 'xlsx').

const constructExportUrl = (baseUrl, params) => {
  const queryParams = new URLSearchParams();
  for (const key in params) {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
      // Special handling for 'fields' if it's an array (like in ReportContext filters)
      if (key === 'fields' && Array.isArray(params[key])) {
        queryParams.append(key, params[key].join(','));
      } else {
        queryParams.append(key, params[key]);
      }
    }
  }
  return `${API_BASE_URL}${baseUrl}?${queryParams.toString()}`;
};

export const getSODetailExportUrl = (params, format) => {
  return constructExportUrl('/so_daily_activity/details/export', { ...params, format });
};

export const getTSMSummaryExportUrl = (params, format) => {
  return constructExportUrl('/so_daily_activity/tsm_summary/export', { ...params, format });
};


// Example of how to construct column filter params before calling API:
// const apiParams = { ...otherParams };
// Object.entries(columnFiltersFromTableState).forEach(([key, value]) => {
//   if (value) { // only add if filter value is set
//     apiParams[`column_filter_${key}`] = value;
//   }
// });
// getSODetails(apiParams);
