// src/components/ReportDisplay/ReportDisplay.js
import React from 'react';
import { Tabs, Card } from 'antd';
import { useReport } from '../../contexts/ReportContext';
import SODetailTab from './SODetailTab';
import TSMSummaryTab from './TSMSummaryTab';
import OverallSummaryTab from './OverallSummaryTab';
import {CarryOutOutlined, BarChartOutlined, PieChartOutlined, SolutionOutlined} from '@ant-design/icons';


const { TabPane } = Tabs;

const ReportDisplay = () => {
  const { activeTab, setActiveTab, applyFiltersAndFetchData, filters } = useReport();

  const handleTabChange = (key) => {
    setActiveTab(key);
    // Fetch data for the new tab if it hasn't been fetched yet or if filters changed
    // The individual tab components also have useEffect to fetch initial data.
    // This ensures that when a tab is clicked, its data is refreshed/fetched.
    // Reset pagination for the new tab when switching
    const initialPagination = { current: 1, pageSize: 10, globalSearch: '' };
    const initialSort = {};
    const initialColumnFilters = {};
    applyFiltersAndFetchData(initialPagination, initialSort, initialColumnFilters, key);
  };

  return (
    <Card>
      <Tabs activeKey={activeTab} onChange={handleTabChange} type="card">
        <TabPane 
            tab={<span><SolutionOutlined /> SO Detail</span>} 
            key="soDetail"
        >
          {activeTab === 'soDetail' && <SODetailTab />}
        </TabPane>
        <TabPane 
            tab={<span><BarChartOutlined /> TSM Summary</span>} 
            key="tsmSummary"
        >
          {activeTab === 'tsmSummary' && <TSMSummaryTab />}
        </TabPane>
        <TabPane 
            tab={<span><PieChartOutlined /> Overall Daily Summary</span>} 
            key="overallSummary"
        >
          {activeTab === 'overallSummary' && <OverallSummaryTab />}
        </TabPane>
      </Tabs>
    </Card>
  );
};

export default ReportDisplay;
