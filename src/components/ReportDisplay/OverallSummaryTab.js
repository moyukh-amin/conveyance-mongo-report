// src/components/ReportDisplay/OverallSummaryTab.js
import React, { useEffect, useMemo } from 'react';
import { useReport } from '../../contexts/ReportContext';
import { Statistic, Row, Col, Card, Typography, Alert, Spin, Tooltip, Space } from 'antd';
import { Line } from '@ant-design/plots'; // Ant Design Charts
import { DollarCircleOutlined, ShoppingCartOutlined, BarChartOutlined, QuestionCircleOutlined } from '@ant-design/icons'; // Example icons
import { DOCS_BASE_URL } from '../../config';

const { Title, Text } = Typography;

const OverallSummaryTab = () => {
  const {
    filters,
    overallSummary,
    availableFields, // To understand what numeric fields were potentially selected
    applyFiltersAndFetchData,
    activeTab,
  } = useReport();

  useEffect(() => {
    if (activeTab === 'overallSummary') {
      // Initial fetch or fetch when critical filters change (handled by FilterPanel's apply button)
       if (!overallSummary.data || Object.keys(overallSummary.data).length === 0 && !overallSummary.loading && filters.date) {
         applyFiltersAndFetchData({}, {}, {}, 'overallSummary');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, filters.date, filters.product_type]);


  const summaryData = overallSummary.data || {};

  // For chart: If API could return a series of summaries for a trend line
  // This is a placeholder as current backend endpoint returns single day summary
  const trendChartData = useMemo(() => {
    // Example: if summaryData could be an array of daily summaries
    if (Array.isArray(summaryData) && summaryData.length > 0) {
      return summaryData.map(day => ({
        date: day.activity_date,
        value: day.overall_total_amount || 0, // Or other primary metric
        category: 'Total Amount'
      }));
    }
    // If single day, can't plot trend unless we fetch multiple days
    // For now, make a single point or leave chart empty/show message
    if (summaryData.activity_date) {
        return [
            { date: summaryData.activity_date, value: summaryData.overall_total_amount || 0, category: 'Total Amount' },
            // Add more points if you fetch historical data for a small trend window
        ];
    }
    return [];
  }, [summaryData]);

  const lineChartConfig = {
    data: trendChartData,
    xField: 'date',
    yField: 'value',
    seriesField: 'category', // If you plot multiple metrics like quantity and amount
    height: 250,
    smooth: true,
    xAxis: { type: 'time' },
    yAxis: { label: { formatter: (v) => `${v}` } }, // Add K, M for large numbers if needed
    legend: { position: 'top-right' },
    tooltip: { shared: true, showCrosshairs: true },
  };
  
  const renderCustomStats = () => {
    if (!summaryData) return null;

    const customStats = [];
    for (const key in summaryData) {
        if (key.startsWith('overall_total_') && 
            key !== 'overall_total_quantity' && 
            key !== 'overall_total_amount') {
            
            // Try to find original field label
            const originalFieldName = key.replace('overall_total_', '');
            let baseLabel = originalFieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); // Default prettified
            let docPath = `overall_summary/metrics/${originalFieldName}`; // Default doc path
            
            const fieldInAvailable = availableFields.find(af => {
                // Backend might name it `overall_total_submitted_data_custom_field`
                // or `overall_total_associated_data_docs_metric`
                const patternSuffix = af.name.replace(/\./g, '_');
                return `overall_total_${patternSuffix}` === key;
            });
            if(fieldInAvailable) {
                baseLabel = `Overall Total ${fieldInAvailable.label}`;
                // Potentially use a specific docPath from fieldInAvailable if it was defined there
                // docPath = fieldInAvailable.doc_path || `overall_summary/metrics/${originalFieldName}`; 
            }

            const statTitle = (
                <Space>
                    <Text>{baseLabel}</Text>
                    <Tooltip title={`SOP for ${baseLabel}`}>
                        <a href={`${DOCS_BASE_URL}/${docPath}`} target="_blank" rel="noopener noreferrer">
                            <QuestionCircleOutlined style={{ color: 'rgba(0,0,0,.45)', fontSize: '0.9em' }} />
                        </a>
                    </Tooltip>
                </Space>
            );

            customStats.push(
                <Col xs={24} sm={12} md={8} lg={6} key={key}>
                    <Card bordered={false}>
                        <Statistic
                            title={statTitle}
                            value={summaryData[key]}
                            precision={2} // Adjust as needed
                            prefix={<BarChartOutlined />}
                        />
                    </Card>
                </Col>
            );
        }
    }
    return customStats;
  };


  if (overallSummary.loading) {
    return <Spin tip="Loading Overall Summary..." style={{ display: 'block', marginTop: 50 }} />;
  }

  if (overallSummary.error) {
    return <Alert message="Error" description={`Failed to load overall summary: ${overallSummary.error.data?.error?.message || overallSummary.error.message}`} type="error" showIcon />;
  }

  if (!summaryData || Object.keys(summaryData).length === 0) {
    return <Alert message="No Summary Data" description="No overall summary data available for the selected filters." type="info" showIcon />;
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 20 }}>Daily Summary for {summaryData.activity_date || filters.date}</Title>
      <Row gutter={[16, 24]}>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card bordered={false} style={{boxShadow: '0 2px 8px rgba(0,0,0,0.09)'}}>
            <Statistic
              title={
                <Space>
                    <Text>Overall Total Quantity</Text>
                    <Tooltip title="SOP for Overall Total Quantity">
                        <a href={`${DOCS_BASE_URL}/overall_summary/total_quantity`} target="_blank" rel="noopener noreferrer">
                            <QuestionCircleOutlined style={{ color: 'rgba(0,0,0,.45)' }} />
                        </a>
                    </Tooltip>
                </Space>
              }
              value={summaryData.overall_total_quantity !== undefined ? summaryData.overall_total_quantity : 'N/A'}
              precision={0}
              prefix={<ShoppingCartOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card bordered={false} style={{boxShadow: '0 2px 8px rgba(0,0,0,0.09)'}}>
            <Statistic
              title={
                 <Space>
                    <Text>Overall Total Amount</Text>
                    <Tooltip title="SOP for Overall Total Amount">
                        <a href={`${DOCS_BASE_URL}/overall_summary/total_amount`} target="_blank" rel="noopener noreferrer">
                            <QuestionCircleOutlined style={{ color: 'rgba(0,0,0,.45)' }} />
                        </a>
                    </Tooltip>
                </Space>
              }
              value={summaryData.overall_total_amount !== undefined ? summaryData.overall_total_amount : 'N/A'}
              precision={2}
              prefix={<DollarCircleOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        {/* Render other dynamically selected numeric fields */}
        {renderCustomStats()}
      </Row>

      <Title level={5} style={{ marginTop: 30, marginBottom: 10 }}>Sales Trend (Placeholder)</Title>
       {trendChartData.length > 1 ? ( // Only show chart if there's a trend
         <Card><Line {...lineChartConfig} /></Card>
       ) : (
         <Text type="secondary">Trend chart requires historical summary data which is not currently implemented for this single-day view.</Text>
       )}
    </div>
  );
};

export default OverallSummaryTab;
