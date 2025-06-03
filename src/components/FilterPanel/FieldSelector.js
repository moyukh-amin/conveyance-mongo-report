// src/components/FilterPanel/FieldSelector.js
import React from 'react';
import { Select, Typography, Tooltip, Space } from 'antd';
import { InfoCircleOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { DOCS_BASE_URL } from '../../config';


const { Option, OptGroup } = Select;
const { Text } = Typography;

const FieldSelector = ({ availableFields, selectedFields, onChange, loading }) => {
  const groupedFields = availableFields.reduce((acc, field) => {
    const groupName = field.source === 'submission' ? `SO Form (${field.source})`
                    : field.source === 'base' ? 'Standard Fields'
                    : field.source === 'hierarchy' ? 'Hierarchy Fields'
                    : `Associated: ${field.source}`;
    if (!acc[groupName]) {
      acc[groupName] = [];
    }
    acc[groupName].push(field);
    return acc;
  }, {});

  return (
    <div>
      <Space align="center" style={{ marginBottom: 4 }}>
        <Text>Select Columns:</Text>
        <Tooltip title="Choose which data columns to display in the SO Detail tab and which numeric columns to aggregate in summaries. Hover over individual fields for more info if available.">
          <InfoCircleOutlined style={{ color: 'rgba(0,0,0,.45)' }} />
        </Tooltip>
        <a href={`${DOCS_BASE_URL}/field_selection_guide`} target="_blank" rel="noopener noreferrer">
          <QuestionCircleOutlined />
        </a>
      </Space>
      <Select
        mode="multiple"
        allowClear
        style={{ width: '100%' }}
        placeholder="Select fields to display"
        value={selectedFields}
        onChange={onChange}
        loading={loading}
        optionLabelProp="label"
      >
        {Object.entries(groupedFields).map(([groupName, fields]) => (
          <OptGroup label={groupName} key={groupName}>
            {fields.map(field => (
              <Option key={field.name} value={field.name} label={field.label}>
                <Space>
                  <span>{field.label} ({field.name})</span>
                  {field.doc_path &&
                    <a href={`${DOCS_BASE_URL}/${field.doc_path}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                      <QuestionCircleOutlined style={{fontSize: '0.8em', color: 'rgba(0,0,0,0.4)'}}/>
                    </a>
                  }
                </Space>
              </Option>
            ))}
          </OptGroup>
        ))}
      </Select>
    </div>
  );
};

export default FieldSelector;
