// src/App.js
import React from 'react';
import { Layout, Typography, Divider, ConfigProvider, theme, Button, Space } from 'antd';
import { ReportProvider } from './contexts/ReportContext';
import FilterPanel from './components/FilterPanel/FilterPanel';
import ReportDisplay from './components/ReportDisplay/ReportDisplay';
import './App.css'; // For any global custom styles
import { BulbOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { DOCS_BASE_URL } from './config';


const { Header, Content, Footer } = Layout;
const { Title, Link } = Typography;

const App = () => {
  // Optional: Theme customization
  const { defaultAlgorithm, darkAlgorithm } = theme;
  const [isDarkMode, setIsDarkMode] = React.useState(false); // Example toggle

  // For Ant Design v5, theme tokens are used like this
  // For older versions, you might need less/CSS variable overrides.
  const antdTheme = {
    algorithm: isDarkMode ? darkAlgorithm : defaultAlgorithm,
    token: {
      // Example: Customize primary color
      // colorPrimary: '#00b96b',
    },
    components: {
        Card: {
            headerBg: isDarkMode ? '#1e1e1e' : '#fafafa', // Example of component specific token
        }
    }
  };

  return (
    <ConfigProvider theme={antdTheme}>
      <ReportProvider>
        <Layout className="layout">
          <Header style={{ display: 'flex', alignItems: 'center', padding: '0 24px', backgroundColor: antdTheme.token.colorPrimary || (isDarkMode ? '#001529' : '#1677ff') }}>
            <BulbOutlined style={{ fontSize: '24px', color: '#fff', marginRight: '16px' }} />
            <Title level={3} style={{ color: '#fff', margin: 0, lineHeight: '64px', flexGrow: 1 }}>
              SO Daily Activity Summary Report
            </Title>
            <Space>
                <a href={`${DOCS_BASE_URL}/faq`} target="_blank" rel="noopener noreferrer">
                    <Button type="link" icon={<QuestionCircleOutlined />} style={{color: '#fff'}}>
                        Help / FAQ
                    </Button>
                </a>
                 {/* Optional: Dark mode toggle example */}
                {/* <Switch checked={isDarkMode} onChange={() => setIsDarkMode(!isDarkMode)} checkedChildren="Dark" unCheckedChildren="Light" /> */}
            </Space>
          </Header>
          <Content style={{ padding: '24px 24px', minHeight: 'calc(100vh - 64px - 70px)' /* Adjust based on header/footer height */ }}>
            <div className="site-layout-content" style={{ background: isDarkMode ? '#141414' : '#fff', padding: 24, borderRadius: antdTheme.token.borderRadiusLG || 8 }}>
              <FilterPanel />
              <Divider />
              <ReportDisplay />
            </div>
          </Content>
          <Footer style={{ textAlign: 'center', backgroundColor: isDarkMode ? '#001529' : '#f0f2f5', color: isDarkMode ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)' }}>
            SO Activity Insights ©{new Date().getFullYear()} Created with Ant Design & React
            <br/>
            <Link href="https://ant.design" target="_blank" style={{color: antdTheme.token.colorPrimary || (isDarkMode ? '#1677ff' : '#1890ff')}}>Ant Design</Link> | <Link href="https://react.dev" target="_blank" style={{color: antdTheme.token.colorPrimary || (isDarkMode ? '#1677ff' : '#1890ff')}}>React</Link>
          </Footer>
        </Layout>
      </ReportProvider>
    </ConfigProvider>
  );
};

export default App;
