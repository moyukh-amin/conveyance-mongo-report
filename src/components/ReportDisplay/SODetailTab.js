// src/components/ReportDisplay/SODetailTab.js
import React, { useEffect, useMemo, useState } from 'react';
import { useReport } from '../../contexts/ReportContext';
import DynamicTable from '../Common/DynamicTable';
import { Alert, Button, Space, Dropdown, Menu } from 'antd';
import { DownloadOutlined, FileExcelOutlined, FileCsvOutlined } from '@ant-design/icons';
import { getSODetailExportUrl } from '../../services/api';

const SODetailTab = () => {
  const {
    filters, // Global filters from ReportContext: date, product_type, selected_fields, use_hierarchy
    soDetails, // Contains data, pagination, loading, error
    availableFields,
    applyFiltersAndFetchData,
    activeTab,
  } = useReport();

  // Local state for table-specific parameters (sorting, column filters, global search)
  // These are typically managed by DynamicTable internally but we need them for export
  const [currentTableParams, setCurrentTableParams] = useState({
    pagination: soDetails.pagination, // Use initial pagination from context
    sortParams: {},
    columnFilters: {},
    globalSearchText: '',
  });

  // Update local state when context's pagination changes (e.g. after data fetch)
  useEffect(() => {
    setCurrentTableParams(prev => ({...prev, pagination: soDetails.pagination}));
  }, [soDetails.pagination]);


  // Fetch data when tab becomes active or core filters change
  useEffect(() => {
    if (activeTab === 'soDetail') {
      // Initial fetch or fetch when critical filters change (handled by FilterPanel's apply button)
      // This effect could be used for auto-refresh on tab activation if desired,
      // but primary data fetch is driven by "Apply Filters" button in FilterPanel.
      // Consider if an immediate fetch on tab activation is needed beyond the FilterPanel's trigger.
      // For now, let's assume FilterPanel's "Apply" is the main trigger.
      // If soDetails.data is empty and not loading, and filters are set, one might trigger an initial load:
      if (soDetails.data.length === 0 && !soDetails.loading && filters.date) {
         applyFiltersAndFetchData({current: 1, pageSize: 10}, {}, {}, 'soDetail');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, filters.date, filters.product_type]); // Add other critical filters if needed for direct re-fetch on change

  const columnsConfig = useMemo(() => {
    if (!filters.selected_fields || filters.selected_fields.length === 0) {
      // Default columns if nothing is selected, or a message
      return [
        { title: 'Info', dataIndex: 'info', key: 'info', render: () => 'Please select fields to display in the Filter Panel.' }
      ];
    }
    return filters.selected_fields.map(fieldKey => {
      const fieldDefinition = availableFields.find(f => f.name === fieldKey);
      const columnDef = {
        title: fieldDefinition?.label || fieldKey,
        dataIndex: fieldKey, // This will be used by DynamicTable's render to access possibly nested data
        key: fieldKey,
        sortable: true, // All selected fields can be candidates for server-side sorting
        filterable: true, // All selected fields can be candidates for server-side filtering
        type: fieldDefinition?.type || 'string', // Pass type for potential formatting or filter input type
        width: fieldDefinition?.name === 'so_name' || fieldDefinition?.name === 'tsm_name' || fieldDefinition?.name === 'rm_name' ? 200 : 150, // Example width
        ellipsis: true,
      };

      // Add specific docPath for 'amount' column if it's selected
      if (fieldKey === 'amount') {
        columnDef.docPath = 'fields/amount_calculation_sop';
      }
      // Example for another field, e.g. 'quantity'
      if (fieldKey === 'quantity') {
        columnDef.docPath = 'fields/quantity_definition';
      }

      return columnDef;
    });
  }, [filters.selected_fields, availableFields]);

  const handleTableChange = (newPagination, sortParams, columnFilters, globalSearchText) => {
    setCurrentTableParams({ pagination: newPagination, sortParams, columnFilters, globalSearchText });
    applyFiltersAndFetchData(newPagination, sortParams, columnFilters, 'soDetail');
  };

  const handleGlobalSearch = (searchText) => {
    const newPagination = { current: 1, pageSize: currentTableParams.pagination?.pageSize || 10, globalSearch: searchText };
    setCurrentTableParams(prev => ({ ...prev, pagination: newPagination, globalSearchText: searchText }));
    // Pass current sort/columnFilters if they should persist from currentTableParams
    applyFiltersAndFetchData(newPagination, currentTableParams.sortParams, currentTableParams.columnFilters, 'soDetail');
  };

  const handleColumnFilter = (updatedColumnFilters) => {
    const newPagination = { current: 1, pageSize: currentTableParams.pagination?.pageSize || 10, globalSearch: currentTableParams.globalSearchText };
    setCurrentTableParams(prev => ({ ...prev, pagination: newPagination, columnFilters: updatedColumnFilters }));
    // Pass current sort if it should persist from currentTableParams
    applyFiltersAndFetchData(newPagination, currentTableParams.sortParams, updatedColumnFilters, 'soDetail');
  };

  const handleExport = (format) => {
    const exportParams = {
      date: filters.date,
      product_type: filters.product_type,
      fields: filters.selected_fields, // ReportContext filters.selected_fields is already an array
      use_hierarchy: filters.use_hierarchy,
      sort_by: currentTableParams.sortParams?.field,
      sort_order: currentTableParams.sortParams?.order === 'ascend' ? 'asc' : currentTableParams.sortParams?.order === 'descend' ? 'desc' : undefined,
      q: currentTableParams.globalSearchText,
      // Add column filters (need to be prefixed with column_filter_ for the backend)
      ...Object.entries(currentTableParams.columnFilters).reduce((acc, [key, value]) => {
        if (value) acc[`column_filter_${key}`] = value;
        return acc;
      }, {})
    };
    const url = getSODetailExportUrl(exportParams, format);
    window.location.href = url; // Trigger download
  };

  const exportMenu = (
    <Menu onClick={({ key }) => handleExport(key)}>
      <Menu.Item key="csv" icon={<FileCsvOutlined />}>Export as CSV</Menu.Item>
      <Menu.Item key="xlsx" icon={<FileExcelOutlined />}>Export as Excel (XLSX)</Menu.Item>
    </Menu>
  );

  return (
    <div>
      <Space style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Dropdown overlay={exportMenu} disabled={soDetails.loading || soDetails.data.length === 0}>
          <Button type="primary" icon={<DownloadOutlined />}>
            Export Data
          </Button>
        </Dropdown>
      </Space>

      {filters.selected_fields.length === 0 && (
        <Alert message="No columns selected" description="Please select columns from the 'Select Columns' dropdown in the Filter Panel to view data." type="info" showIcon style={{marginBottom: 16}}/>
      )}
      <DynamicTable
        data={soDetails.data}
        pagination={currentTableParams.pagination} // Use local state for table's current view of pagination
        loading={soDetails.loading}
        error={soDetails.error}
        columnsConfig={columnsConfig}
        onTableChange={handleTableChange}
        onSearch={handleGlobalSearch}
        onColumnFilter={handleColumnFilter}
        rowKey="_id" // Assuming '_id' is the unique identifier for SO Detail records
      />
    </div>
  );
};

export default SODetailTab;
