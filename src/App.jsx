import { useCallback, useEffect, useMemo, useState } from 'react';
import Header from './components/Header.jsx';
import StatsGrid from './components/StatsGrid.jsx';
import UploadSection from './components/UploadSection.jsx';
import InvoiceTable from './components/InvoiceTable.jsx';
import Drawer from './components/Drawer.jsx';
import { fetchScanLogs, fetchStats, verifyInvoiceWithUpload } from './services/api.js';
import { buildWhereFromQuery, createProcessingRecord, mapLogToRecord } from './utils/invoice.js';

const pageSize = 10;

const App = () => {
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({ total: 0, success: 0, fail: 0 });
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / pageSize)), [totalCount]);

  const loadLogs = useCallback(async (pageIndex, searchQuery) => {
    try {
      setError('');
      const { rows, total, where, stats: fetchedStats } = await fetchScanLogs(pageIndex, pageSize, searchQuery);
      console.log('[scan-logs]', rows);
      const mapped = rows.map(mapLogToRecord).map((item, index) => ({ ...item, key: `${item.code}-${item.id}-${index}` }));
      setRecords(mapped);
      setTotalCount(total);
      if (fetchedStats) {
        const fail = Math.max(fetchedStats.total - fetchedStats.success, 0);
        setStats({ total: fetchedStats.total, success: fetchedStats.success, fail });
      } else {
        const stat = await fetchStats(where || buildWhereFromQuery(searchQuery));
        const fail = Math.max(stat.total - stat.success, 0);
        setStats({ total: stat.total, success: stat.success, fail });
      }
    } catch (e) {
      setError('加载记录失败');
    }
  }, []);

  useEffect(() => {
    loadLogs(page, query);
  }, [page, query, loadLogs]);

  useEffect(() => {
    window.verifyInvoiceWithUpload = verifyInvoiceWithUpload;
  }, []);

  const handleFiles = async (files) => {
    for (const file of files) {
      const key = `${file.name}-${Date.now()}-${Math.random()}`;
      const processing = createProcessingRecord(file, key);
      setRecords((prev) => [processing, ...prev]);
      try {
        const result = await verifyInvoiceWithUpload(file);
        const record = {
          ...result.data,
          status: result.success ? 'success' : 'fail',
          preview: result.preview,
          message: result.raw && result.raw.message ? result.raw.message : '查验失败',
          key
        };
        setRecords((prev) => prev.map((item) => (item.key === key ? record : item)));
      } catch (e) {
        setRecords((prev) =>
          prev.map((item) =>
            item.key === key
              ? { ...item, status: 'fail', message: e && e.message ? e.message : '查验失败' }
              : item
          )
        );
      }
    }
  };

  return (
    <div className="app-container">
      <Header />
      <main>
        <StatsGrid total={stats.total} success={stats.success} fail={stats.fail} />
        <UploadSection onFiles={handleFiles} />
        {error ? <div className="error-hint">{error}</div> : null}
        <InvoiceTable
          records={records}
          query={query}
          onQueryChange={setQuery}
          onSearch={() => {
            setPage(1);
            loadLogs(1, query);
          }}
          onClear={() => {
            setQuery('');
            setPage(1);
            loadLogs(1, '');
          }}
          page={page}
          totalPages={totalPages}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
          onView={(record) => setSelected(record)}
        />
      </main>
      <Drawer record={selected} onClose={() => setSelected(null)} />
    </div>
  );
};

export default App;
