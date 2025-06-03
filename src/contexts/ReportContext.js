// src/contexts/ReportContext.js
import React, { createContext, useState, useContext } from 'react';
import { getAvailableFields, getSODetails, getTSMSummary, getOverallSummary } from '../services/api';
import { message } from 'antd'; // For user feedback

const ReportContext = createContext();

export const useReport = () => useContext(ReportContext);

export const ReportProvider = ({ children }) => {
  const initialFilters = {
    date: new Date().toISOString().split('T')[0], // Default to today
    product_type: 'Combined',
    selected_fields: [], // Array of field names/paths e.g., ["so_name", "submitted_data.customer_name"]
    use_hierarchy: true,
    form_id: 'SO_FORM_ID', // Default form_id
  };

  const [filters, setFilters] = useState(initialFilters);
  const [availableFields, setAvailableFields] = useState([]);
  const [soDetails, setSoDetails] = useState({ data: [], pagination: {}, loading: false, error: null });
  const [tsmSummary, setTsmSummary] = useState({ data: [], pagination: {}, loading: false, error: null });
  const [overallSummary, setOverallSummary] = useState({ data: {}, loading: false, error: null });
  const [activeTab, setActiveTab] = useState('soDetail'); // 'soDetail', 'tsmSummary', 'overallSummary'

  const fetchAvailableFields = async (formId = filters.form_id) => {
    try {
      const response = await getAvailableFields(formId);
      const fields = response.data.available_fields || [];
      // Pre-select some basic fields by default for a better UX
      const defaultSelectedFields = fields
        .filter(f => ['activity_date', 'so_name', 'product_type', 'quantity', 'amount', 'tsm_name'].includes(f.name))
        .map(f => f.name);

      setAvailableFields(fields);
      if (filters.selected_fields.length === 0 && fields.length > 0) {
        setFilters(prev => ({ ...prev, selected_fields: defaultSelectedFields }));
      }
      return fields; // Return for immediate use if needed
    } catch (error) {
      message.error('Failed to fetch available fields.');
      console.error("Error fetching available fields:", error);
      setAvailableFields([]); // Set to empty on error
      return [];
    }
  };

  const handleFilterChange = (changedFilters) => {
    setFilters(prev => ({ ...prev, ...changedFilters }));
  };

  const applyFiltersAndFetchData = async (paginationParams = {}, sortParams = {}, columnFilters = {}, tab = activeTab) => {
    const commonApiParams = {
      date: filters.date,
      product_type: filters.product_type,
      // 'fields' for details is a list of columns to display.
      // 'fields' for summaries is a list of numeric columns to aggregate.
      // This needs to be handled based on the tab.
      use_hierarchy: filters.use_hierarchy,
    };

    // Construct column filter params for the API
    Object.entries(columnFilters).forEach(([key, value]) => {
        if (value && String(value).trim() !== "") { // only add if filter value is set and not empty
            commonApiParams[`column_filter_${key}`] = value;
        }
    });

    if (sortParams.field && sortParams.order) {
        commonApiParams.sort_by = sortParams.field;
        commonApiParams.sort_order = sortParams.order === 'ascend' ? 'asc' : 'desc';
    }


    if (tab === 'soDetail') {
      setSoDetails(prev => ({ ...prev, loading: true, error: null }));
      try {
        const apiParams = {
          ...commonApiParams,
          fields: filters.selected_fields.join(','),
          page: paginationParams.current || 1,
          page_size: paginationParams.pageSize || 10,
          q: paginationParams.globalSearch || "", // Global search text
        };
        const response = await getSODetails(apiParams);
        setSoDetails({ data: response.data.data, pagination: response.data.pagination, loading: false, error: null });
      } catch (error) {
        message.error('Failed to fetch SO Details.');
        setSoDetails({ data: [], pagination: {}, loading: false, error });
      }
    } else if (tab === 'tsmSummary') {
      setTsmSummary(prev => ({ ...prev, loading: true, error: null }));
      try {
        // For summary, 'fields' should be numeric fields selected for aggregation.
        // This assumes selected_fields might contain non-numeric ones; we need to filter.
        // Or, have a separate selector for numeric aggregation fields for summaries.
        // For now, let's assume the backend can handle non-numeric gracefully or we send all.
        const numericFieldsForSummary = filters.selected_fields.filter(fieldName => {
            const fieldDef = availableFields.find(f => f.name === fieldName);
            return fieldDef && (fieldDef.type === 'number' || fieldDef.type === 'integer' || fieldDef.type === 'float' || fieldDef.type === 'double');
        }).join(',');

        const apiParams = {
          ...commonApiParams,
          fields: numericFieldsForSummary || "quantity,amount", // Default to quantity,amount if no numeric selected
          page: paginationParams.current || 1,
          page_size: paginationParams.pageSize || 10,
          q: paginationParams.globalSearch || "",
        };
        const response = await getTSMSummary(apiParams);
        setTsmSummary({ data: response.data.data, pagination: response.data.pagination, loading: false, error: null });
      } catch (error) {
        message.error('Failed to fetch TSM Summary.');
        setTsmSummary({ data: [], pagination: {}, loading: false, error });
      }
    } else if (tab === 'overallSummary') {
      setOverallSummary(prev => ({ ...prev, loading: true, error: null }));
      try {
        const numericFieldsForSummary = filters.selected_fields.filter(fieldName => {
            const fieldDef = availableFields.find(f => f.name === fieldName);
            return fieldDef && (fieldDef.type === 'number' || field_def.type === 'integer' || fieldDef.type === 'float' || fieldDef.type === 'double');
        }).join(',');

        const apiParams = {
          ...commonApiParams,
          fields: numericFieldsForSummary || "quantity,amount",
        };
        // Overall summary doesn't have pagination/sorting from its own table
        const response = await getOverallSummary(apiParams);
        setOverallSummary({ data: response.data.data, loading: false, error: null });
      } catch (error) {
        message.error('Failed to fetch Overall Summary.');
        setOverallSummary({ data: {}, loading: false, error });
      }
    }
  };

  return (
    <ReportContext.Provider
      value={{
        filters,
        availableFields,
        soDetails,
        tsmSummary,
        overallSummary,
        activeTab,
        handleFilterChange,
        fetchAvailableFields,
        applyFiltersAndFetchData,
        setActiveTab,
        setSoDetails, // Allow direct manipulation for table-driven updates
        setTsmSummary,
      }}
    >
      {children}
    </ReportContext.Provider>
  );
};
