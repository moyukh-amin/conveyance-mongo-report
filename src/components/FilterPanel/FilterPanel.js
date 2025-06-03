// src/components/FilterPanel/FilterPanel.js
import React, { useEffect } from 'react';
import { Row, Col, DatePicker, Select, Button, Switch, Card, Tooltip, Space, Typography } from 'antd';
import { SearchOutlined, InfoCircleOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs'; // For DatePicker default value
import { useReport } from '../../contexts/ReportContext';
import { DOCS_BASE_URL } from '../../config';
import FieldSelector from './FieldSelector';

const { Option } = Select;

const FilterPanel = () => {
  const {
    filters,
    availableFields,
    handleFilterChange,
    fetchAvailableFields,
    applyFiltersAndFetchData,
    activeTab,
    soDetails, // to check loading state for field selector
  } = useReport();

  useEffect(() => {
    fetchAvailableFields(filters.form_id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.form_id]); // Fetch once on mount or if form_id changes

  const onApply = () => {
    // When applying filters, reset pagination to page 1 for the active tab's current data.
    // The actual data fetching for the active tab will handle its own pagination state.
    // For SO Details and TSM Summary, we pass default pagination to fetch the first page.
    const initialPagination = { current: 1, pageSize: 10, globalSearch: '' }; // Reset global search too
    const initialSort = {};
    const initialColumnFilters = {};
    applyFiltersAndFetchData(initialPagination, initialSort, initialColumnFilters, activeTab);
  };

  const onDateChange = (date, dateString) => {
    handleFilterChange({ date: dateString });
  };

  const onProductTypeChange = (value) => {
    handleFilterChange({ product_type: value });
  };

  const onSelectedFieldsChange = (selected) => {
    handleFilterChange({ selected_fields: selected });
  };

  const onUseHierarchyChange = (checked) => {
    handleFilterChange({ use_hierarchy: checked });
  };

  // Form ID change handler (if you want to make it dynamic, e.g., via an input/select)
  // const onFormIdChange = (value) => {
  //   handleFilterChange({ form_id: value, selected_fields: [] }); // Reset selected fields when form_id changes
  //   fetchAvailableFields(value); // Re-fetch fields for new form_id
  // };


  return (
    <Card title="Filters & Report Configuration" style={{ marginBottom: 20 }}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8} lg={6}>
            <DatePicker
              style={{ width: '100%' }}
              onChange={onDateChange}
              defaultValue={dayjs(filters.date, 'YYYY-MM-DD')}
              format="YYYY-MM-DD"
              allowClear={false}
            />
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Select
              style={{ width: '100%' }}
              value={filters.product_type}
              onChange={onProductTypeChange}
            >
              <Option value="Combined">All Product Types</Option>
              <Option value="Anbar">Anbar</Option>
              <Option value="Bobo">Bobo</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Tooltip title="Use organizational hierarchy to determine TSM/RM. If unchecked, simpler manager data (if available on user record) might be used. Primarily affects TSM Summary and TSM/RM names in SO Detail.">
              <Switch
                checkedChildren="Hierarchy On"
                unCheckedChildren="Hierarchy Off"
                checked={filters.use_hierarchy}
                onChange={onUseHierarchyChange}
              />
            </Tooltip>
            <InfoCircleOutlined style={{ marginLeft: 8, color: 'rgba(0,0,0,.45)' }} />
            <a href={`${DOCS_BASE_URL}/use_hierarchy_explained`} target="_blank" rel="noopener noreferrer" style={{marginLeft: '5px'}}>
                <QuestionCircleOutlined />
            </a>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24}>
            <FieldSelector
              availableFields={availableFields}
              selectedFields={filters.selected_fields}
              onChange={onSelectedFieldsChange}
              loading={soDetails.loading} // Example: tie loading to one of the data fetching states
            />
          </Col>
        </Row>

        {/* Optional: Form ID selector if you plan to support multiple forms */}
        {/* <Row gutter={[16,16]}>
            <Col xs={24} sm={12} md={8} lg={6}>
                <Input
                    addonBefore="Form ID:"
                    value={filters.form_id}
                    onChange={(e) => handleFilterChange({ form_id: e.target.value })}
                    onBlur={(e) => {
                        fetchAvailableFields(e.target.value);
                        handleFilterChange({ selected_fields: [] }); // Reset fields
                    }}
                />
            </Col>
        </Row> */}


        <Row>
          <Col xs={24} style={{ textAlign: 'right' }}>
            <Button type="primary" icon={<SearchOutlined />} onClick={onApply}>
              Apply Filters & Fetch Data
            </Button>
          </Col>
        </Row>
      </Space>
    </Card>
  );
};

export default FilterPanel;
