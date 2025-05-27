// src/components/Common/DynamicTable.js
import React, { useState, useEffect } from 'react';
import { Table, Input, Button, Space, Tooltip, Typography } from 'antd';
import { SearchOutlined, ClearOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { DOCS_BASE_URL } from '../../config';

const { Search } = Input;
const { Text } = Typography;

const DynamicTable = ({
  data,
  pagination,
  loading,
  error,
  columnsConfig, // Array of { key, title, dataIndex, sortable, filterable, type (for filter input type) }
  onTableChange, // Function to handle pagination, sorting, filtering changes
  onSearch, // Function to handle global search
  onColumnFilter, // Function to handle column specific filter
  scrollX = 'max-content', // Default horizontal scroll
  rowKey = '_id', // Default row key
}) => {
  const [tableColumns, setTableColumns] = useState([]);
  const [globalSearchText, setGlobalSearchText] = useState('');
  const [columnFilters, setColumnFilters] = useState({});

  // Column filter input refs
  const searchInputRefs = React.useRef({});

  const handleTableChange = (newPagination, filters, sorter) => {
    // Antd's sorter can be an object or an array. We handle the object case.
    const sortParams = sorter.field && sorter.order ? { field: sorter.field, order: sorter.order } : {};
    // Pass current globalSearchText and columnFilters as well
    onTableChange(newPagination, sortParams, columnFilters, globalSearchText);
  };

  const handleGlobalSearch = (value) => {
    setGlobalSearchText(value);
    // Trigger data fetch with new search text, reset pagination
    onSearch(value);
  };
  
  const handleResetGlobalSearch = () => {
    setGlobalSearchText('');
    onSearch(''); // Fetch data with empty search
  };

  const handleColumnSearch = (selectedKeys, confirm, dataIndex) => {
    confirm();
    setColumnFilters(prev => ({ ...prev, [dataIndex]: selectedKeys[0] }));
    // Trigger data fetch with new column filter
    // For column filters, we need to pass all current filters, pagination, sort, and global search
    onColumnFilter({ ...columnFilters, [dataIndex]: selectedKeys[0] });
  };

  const handleColumnReset = (clearFilters, dataIndex) => {
    clearFilters();
    const newColumnFilters = { ...columnFilters };
    delete newColumnFilters[dataIndex]; // Or set to null/undefined
    setColumnFilters(newColumnFilters);
    onColumnFilter(newColumnFilters); // Trigger fetch with removed filter
  };


  useEffect(() => {
    const antdColumns = columnsConfig.map(col => {
      let columnTitle = col.title;
      if (col.docPath) {
        columnTitle = (
          <Space>
            <Text>{col.title}</Text>
            <Tooltip title={`Click for SOP on ${col.title}`}>
              <a href={`${DOCS_BASE_URL}/${col.docPath}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                <QuestionCircleOutlined style={{ color: 'rgba(0,0,0,.45)'}} />
              </a>
            </Tooltip>
          </Space>
        );
      }

      const column = {
        title: columnTitle,
        dataIndex: col.dataIndex,
        key: col.key || col.dataIndex,
        sorter: col.sortable ? true : false, // Server-side sorting
        ellipsis: col.ellipsis !== undefined ? col.ellipsis : true, // Default to ellipsis for long text
        width: col.width, // Allow specifying width
        // Default render for potentially nested data (e.g., 'user.name')
        render: (text, record) => {
            // Basic nested data access, can be customized further
            if (col.dataIndex && col.dataIndex.includes('.')) {
                return col.dataIndex.split('.').reduce((obj, key) => (obj && obj[key] !== 'undefined') ? obj[key] : (col.type === 'number' ? 0 : 'N/A'), record);
            }
            if (col.type === 'date' && text) {
                 return new Date(text).toLocaleDateString(); // Basic date formatting
            }
            if (col.type === 'datetime' && text) {
                 return new Date(text).toLocaleString(); // Basic datetime formatting
            }
            if (text === null || text === undefined) {
                return col.type === 'number' ? 0 : 'N/A';
            }
            return text;
        }
      };

      if (col.filterable) {
        column.filterDropdown = ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
          <div style={{ padding: 8 }}>
            <Input
              ref={node => { searchInputRefs.current[col.dataIndex] = node; }}
              placeholder={`Search ${col.title}`}
              value={selectedKeys[0]}
              onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
              onPressEnter={() => handleColumnSearch(selectedKeys, confirm, col.dataIndex)}
              style={{ marginBottom: 8, display: 'block' }}
            />
            <Space>
              <Button
                type="primary"
                onClick={() => handleColumnSearch(selectedKeys, confirm, col.dataIndex)}
                icon={<SearchOutlined />}
                size="small"
                style={{ width: 90 }}
              >
                Search
              </Button>
              <Button onClick={() => clearFilters && handleColumnReset(clearFilters, col.dataIndex)} size="small" style={{ width: 90 }}>
                Reset
              </Button>
            </Space>
          </div>
        );
        column.filterIcon = filtered => <SearchOutlined style={{ color: filtered ? '#1890ff' : undefined }} />;
        column.onFilterDropdownOpenChange = visible => {
            if (visible) {
              setTimeout(() => searchInputRefs.current[col.dataIndex]?.select(), 100);
            }
        };
        // We don't need onFilter for server-side filtering, but if we did client-side:
        // column.onFilter = (value, record) =>
        //   record[col.dataIndex] ? record[col.dataIndex].toString().toLowerCase().includes(value.toLowerCase()) : '';
        
        // Set filtered value for UI indication
        if (columnFilters[col.dataIndex]) {
            column.filteredValue = [columnFilters[col.dataIndex]];
        } else {
            column.filteredValue = null;
        }
      }
      return column;
    });
    setTableColumns(antdColumns);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnsConfig, columnFilters]); // Rebuild columns if config or local columnFilters change

  if (error) {
    return <div style={{color: 'red'}}>Error loading data: {error.data?.error?.message || error.message || 'Unknown error'}</div>;
  }

  return (
    <Space direction="vertical" style={{width: '100%'}}>
        <Row justify="end" style={{marginBottom: 16}}>
            <Col xs={24} sm={12} md={8}>
                <Search
                    placeholder="Global search across table..."
                    allowClear
                    enterButton={<><SearchOutlined /> Search</>}
                    size="middle"
                    value={globalSearchText}
                    onChange={(e) => setGlobalSearchText(e.target.value)}
                    onSearch={handleGlobalSearch}
                />
                 {globalSearchText && <Button icon={<ClearOutlined />} onClick={handleResetGlobalSearch} style={{marginLeft: 8}} >Clear</Button>}
            </Col>
        </Row>
        <Table
            columns={tableColumns}
            dataSource={data}
            rowKey={rowKey}
            pagination={{
                current: pagination.page,
                pageSize: pagination.page_size,
                total: pagination.total_items,
                showSizeChanger: true,
                showQuickJumper: true,
                pageSizeOptions: ['10', '20', '50', '100'],
            }}
            loading={loading}
            onChange={handleTableChange} // Handles pagination, sort, and antd's internal filter state change
            scroll={{ x: scrollX, y: 500 }} // Enable horizontal and vertical scroll
            size="middle"
            bordered
        />
    </Space>
  );
};

export default DynamicTable;
