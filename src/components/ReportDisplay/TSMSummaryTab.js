// src/components/ReportDisplay/TSMSummaryTab.js
import React, { useEffect, useMemo, useState } from 'react';
import { useReport } from '../../contexts/ReportContext';
import DynamicTable from '../Common/DynamicTable';
import { Bar } from '@ant-design/plots'; // Ant Design Charts
import { Alert, Typography, Button, Space, Dropdown, Menu } from 'antd';
import { DownloadOutlined, FileExcelOutlined, FileCsvOutlined } from '@ant-design/icons';
import { getTSMSummaryExportUrl } from '../../services/api';


const { Title } = Typography;

const TSMSummaryTab = () => {
  const {
    filters, // Global: date, product_type, selected_fields (for potential numeric aggregation), use_hierarchy
    tsmSummary, // Contains data, pagination, loading, error
    availableFields,
    applyFiltersAndFetchData,
    activeTab,
  } = useReport();

  const [currentTableParams, setCurrentTableParams] = useState({
    pagination: tsmSummary.pagination,
    sortParams: {},
    columnFilters: {},
    globalSearchText: '',
  });
  
  useEffect(() => {
    setCurrentTableParams(prev => ({...prev, pagination: tsmSummary.pagination}));
  }, [tsmSummary.pagination]);

  useEffect(() => {
    if (activeTab === 'tsmSummary') {
      if (tsmSummary.data.length === 0 && !tsmSummary.loading && filters.date) {
         applyFiltersAndFetchData(currentTableParams.pagination || {current: 1, pageSize: 10}, currentTableParams.sortParams, currentTableParams.columnFilters, 'tsmSummary');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, filters.date, filters.product_type, filters.use_hierarchy]);


  const numericFieldsForSummary = useMemo(() => {
    // These are the fields that were summed by the backend.
    // The backend returns them prefixed with 'total_' or 'overall_total_'.
    // We need to find which of the selected_fields are numeric and would have been summed.
    // Or, more reliably, derive from the keys present in tsmSummary.data[0] if data exists.
    if (tsmSummary.data.length > 0) {
        return Object.keys(tsmSummary.data[0])
            .filter(key => key.startsWith('total_') || key.startsWith('overall_total_'))
            .map(key => ({ 
                name: key, 
                label: key.replace(/total_|overall_total_/g, '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) // Prettify
            }));
    }
    // Fallback if no data yet, try to infer from selected_fields and availableFields
    return filters.selected_fields
        .map(sf => availableFields.find(af => af.name === sf))
        .filter(af => af && (af.type === 'number' || af.type === 'integer' || af.type === 'float' || af.type === 'double'))
        .map(af => ({ name: `total_${af.name.replace(/\./g, '_')}`, label: `Total ${af.label}` }));
  }, [tsmSummary.data, filters.selected_fields, availableFields]);


  const columnsConfig = useMemo(() => {
    const baseColumns = [
      { title: 'TSM Name', dataIndex: 'tsm_name', key: 'tsm_name', sortable: true, filterable: true, width: 200, docPath: "tsm/tsm_name_definition" },
      { title: 'Activity Date', dataIndex: 'activity_date', key: 'activity_date', sortable: true, filterable: true, type: 'date', width: 150 },
      { title: 'Number of SOs', dataIndex: 'number_of_sos', key: 'number_of_sos', sortable: true, type: 'number', width: 150, docPath: "tsm/number_of_sos_explained" },
    ];

    // Add columns for each summed numeric field
    // The backend returns fields like 'total_quantity', 'total_amount', 'total_submitted_data_custom_metric'
    const dynamicSumColumns = [];
    if (tsmSummary.data.length > 0) {
        const sampleItem = tsmSummary.data[0];
        for (const key in sampleItem) {
            if (key.startsWith('total_') && key !== 'total_quantity' && key !== 'total_amount') { // quantity & amount are often standard
                 dynamicSumColumns.push({
                    title: key.replace('total_', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                    dataIndex: key,
                    key: key,
                    sortable: true,
                    type: 'number',
                    width: 180,
                 });
            }
        }
    } else if (filters.selected_fields.length > 0) {
        // Fallback if no data yet, construct from selected numeric fields
        filters.selected_fields.forEach(fieldKey => {
            const fieldDef = availableFields.find(f => f.name === fieldKey);
            if (fieldDef && (fieldDef.type === 'number' || fieldDef.type === 'integer')) {
                const dataIdx = `total_${fieldKey.replace(/\./g, '_')}`; // Matches backend naming convention
                 if (!baseColumns.find(bc => bc.dataIndex === dataIdx) && !dynamicSumColumns.find(dc => dc.dataIndex === dataIdx)) {
                    dynamicSumColumns.push({
                        title: `Total ${fieldDef.label}`,
                        dataIndex: dataIdx,
                        key: dataIdx,
                        sortable: true,
                        type: 'number',
                        width: 180,
                    });
                 }
            }
        });
    }
    
    // Ensure quantity and amount are included if not already dynamically added with a specific name
    // And add docPath for them
    const hasTotalQuantity = tsmSummary.data.length > 0 && 'total_quantity' in tsmSummary.data[0];
    const hasTotalAmount = tsmSummary.data.length > 0 && 'total_amount' in tsmSummary.data[0];

    if (!dynamicSumColumns.find(c => c.dataIndex === 'total_quantity') && hasTotalQuantity) {
         baseColumns.push({ title: 'Total Quantity', dataIndex: 'total_quantity', key: 'total_quantity', sortable: true, type: 'number', width: 150, docPath: "tsm/total_quantity_sop" });
    }
     if (!dynamicSumColumns.find(c => c.dataIndex === 'total_amount') && hasTotalAmount) {
         baseColumns.push({ title: 'Total Amount', dataIndex: 'total_amount', key: 'total_amount', sortable: true, type: 'number', width: 150, docPath: "tsm/total_amount_sop" });
    }


    return [...baseColumns, ...dynamicSumColumns];
  }, [tsmSummary.data, filters.selected_fields, availableFields]);

  const handleTableChange = (newPagination, sortParams, columnFilters, globalSearchText) => {
    setCurrentTableParams({ pagination: newPagination, sortParams, columnFilters, globalSearchText });
    applyFiltersAndFetchData(newPagination, sortParams, columnFilters, 'tsmSummary');
  };

  const handleGlobalSearch = (searchText) => {
    const newPagination = { current: 1, pageSize: currentTableParams.pagination?.pageSize || 10, globalSearch: searchText };
    setCurrentTableParams(prev => ({ ...prev, pagination: newPagination, globalSearchText: searchText }));
    applyFiltersAndFetchData(newPagination, currentTableParams.sortParams, currentTableParams.columnFilters, 'tsmSummary');
  };
  
  const handleColumnFilter = (updatedColumnFilters) => {
    const newPagination = { current: 1, pageSize: currentTableParams.pagination?.pageSize || 10, globalSearch: currentTableParams.globalSearchText };
    setCurrentTableParams(prev => ({ ...prev, pagination: newPagination, columnFilters: updatedColumnFilters }));
    applyFiltersAndFetchData(newPagination, currentTableParams.sortParams, updatedColumnFilters, 'tsmSummary');
  };

  const handleExport = (format) => {
    // For TSM Summary, 'fields' param for export should be the numeric fields intended for aggregation
    // This logic should align with how ReportContext determines numeric fields for summary API calls
    const summableFields = filters.selected_fields.filter(fieldName => {
        const fieldDef = availableFields.find(f => f.name === fieldName);
        return fieldDef && (fieldDef.type === 'number' || fieldDef.type === 'integer' || fieldDef.type === 'float' || fieldDef.type === 'double');
    });
    // If no specific numeric fields are selected, backend defaults to quantity,amount.
    // We can pass empty or the specific ones if selected.
    
    const exportParams = {
      date: filters.date,
      product_type: filters.product_type,
      fields: summableFields, // Array of numeric field names/paths
      use_hierarchy: filters.use_hierarchy, // Crucial for TSM summary
      sort_by: currentTableParams.sortParams?.field,
      sort_order: currentTableParams.sortParams?.order === 'ascend' ? 'asc' : currentTableParams.sortParams?.order === 'descend' ? 'desc' : undefined,
      q: currentTableParams.globalSearchText,
      ...Object.entries(currentTableParams.columnFilters).reduce((acc, [key, value]) => {
        if (value) acc[`column_filter_${key}`] = value;
        return acc;
      }, {})
    };
    const url = getTSMSummaryExportUrl(exportParams, format);
    window.location.href = url;
  };

   const exportMenu = (
    <Menu onClick={({ key }) => handleExport(key)}>
      <Menu.Item key="csv" icon={<FileCsvOutlined />}>Export as CSV</Menu.Item>
      <Menu.Item key="xlsx" icon={<FileExcelOutlined />}>Export as Excel (XLSX)</Menu.Item>
    </Menu>
  );

  // Chart Data Preparation
  const chartData = useMemo(() => {
    if (!tsmSummary.data || tsmSummary.data.length === 0) return [];
    // Let's assume we want to chart 'total_amount' or the first available 'total_custom_field'
    const valueField = numericFieldsForSummary.find(f => f.name === 'total_amount')?.name || numericFieldsForSummary[0]?.name || 'total_quantity';
    
    return tsmSummary.data.map(item => ({
      category: item.tsm_name,
      value: item[valueField] || 0,
    }));
  }, [tsmSummary.data, numericFieldsForSummary]);

  const barChartConfig = {
    data: chartData,
    xField: 'value',
    yField: 'category',
    seriesField: 'category',
    height: 300,
    legend: { position: 'top-left' },
    tooltip: { shared: true, showMarkers: false },
    label: {
        position: 'middle', // 'top', 'bottom', 'middle'
        // content: (item) => `${item.value}`, // Customize label content
        style: {
          fill: '#fff',
          opacity: 0.8,
        },
      },
  };

  return (
    <div>
      <Space style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={5} style={{ margin: 0 }}>
            TSM Performance Chart (Sum of {numericFieldsForSummary.find(f=>f.name === (barChartConfig.data[0] ? Object.keys(barChartConfig.data[0]).find(k => k === 'value' ? barChartConfig.data[0][k] : null) : 'total_amount'))?.label || 'Selected Metric'})
        </Title>
        <Dropdown overlay={exportMenu} disabled={tsmSummary.loading || tsmSummary.data.length === 0}>
          <Button type="primary" icon={<DownloadOutlined />}>
            Export Summary Data
          </Button>
        </Dropdown>
      </Space>

      {chartData.length > 0 ? (
        <Bar {...barChartConfig} />
      ) : (
        !tsmSummary.loading && <Alert message="No data available for chart or TSM names are missing." type="info" showIcon />
      )}
      <Title level={5} style={{marginTop: 24}}>TSM Summary Table</Title>
      <DynamicTable
        data={tsmSummary.data}
        pagination={currentTableParams.pagination}
        loading={tsmSummary.loading}
        error={tsmSummary.error}
        columnsConfig={columnsConfig}
        onTableChange={handleTableChange}
        onSearch={handleGlobalSearch}
        onColumnFilter={handleColumnFilter}
        // TSM Summary might not have a single unique _id if grouped by tsm_name and date.
        // Create a composite key or ensure backend provides one. For now, use tsm_name + date.
        rowKey={(record) => `${record.tsm_name}-${record.activity_date}`}
      />
    </div>
  );
};

export default TSMSummaryTab;
