import { useCallback, useEffect, useMemo, useState } from 'react';
import Header from './components/Header.jsx';
import StatsGrid from './components/StatsGrid.jsx';
import UploadSection from './components/UploadSection.jsx';
import InvoiceTable from './components/InvoiceTable.jsx';
import Drawer from './components/Drawer.jsx';
import { fetchScanLogs, fetchStats, markScanLogDeleted, verifyInvoiceWithUpload } from './services/api.js';
import { buildWhereFromQuery, createProcessingRecord, mapLogToRecord } from './utils/invoice.js';

const pageSize = 10;

const isDeletedRow = (row) => {
  const value = row && (row.isdelete ?? row.isdelet ?? row.IsDelete ?? row.IsDelet ?? row.ISDELETE ?? row.ISDELET);
  if (value === undefined || value === null || value === '') return false;
  if (typeof value === 'boolean') return value;
  const text = String(value).toLowerCase();
  return text === '1' || text === 'true' || text === 'y' || text === 'yes';
};

const App = () => {
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({ total: 0, success: 0, fail: 0 });
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [query, setQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [cachedNotice, setCachedNotice] = useState(false);
  const [selected, setSelected] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / pageSize)), [totalCount]);

  const loadLogs = useCallback(async (pageIndex, searchQuery) => {
    try {
      setError('');
      const { rows, total, where, stats: fetchedStats } = await fetchScanLogs(pageIndex, pageSize, searchQuery);
      const activeRows = rows.filter((row) => !isDeletedRow(row));
      console.log('[scan-logs]', rows);
      const mapped = activeRows
        .map((row, index) => ({ row, index }))
        .map(({ row, index }) => {
          const item = mapLogToRecord(row);
          const rowId = row && (row.ID || row.Id || row.id || row._id || row.sys_id);
          return { ...item, rowId: rowId ? String(rowId) : '', key: rowId ? String(rowId) : `${item.code}-${item.id}-${index}` };
        });
      const deduped = (() => {
        const map = new Map();
        mapped.forEach((item) => {
          const k = `${item.code}-${item.id}`;
          const existed = map.get(k);
          if (!existed) {
            map.set(k, item);
            return;
          }
          const a = String(existed.uploadTime || '');
          const b = String(item.uploadTime || '');
          if (b > a) map.set(k, item);
        });
        return Array.from(map.values());
      })();
      setRecords(deduped);
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

  const handleDelete = useCallback(async (record) => {
    if (!record || !record.rowId) {
      setError('记录缺少唯一ID');
      return;
    }
    setPendingDelete(record);
  }, [loadLogs, page, query, selected]);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete || !pendingDelete.rowId) return;
    try {
      setError('');
      setDeleteLoading(true);
      const res = await markScanLogDeleted(pendingDelete.rowId);
      console.log('[delete response]', res);
      if (!res || res.STATUS === 'Error') {
        setError('删除失败');
        return;
      }
      if (selected && selected.key === pendingDelete.key) setSelected(null);
      setRecords((prev) => prev.filter((item) => item.key !== pendingDelete.key));
      setPendingDelete(null);
      loadLogs(page, query);
    } catch (e) {
      setError('删除失败');
      console.warn('delete failed', e);
    } finally {
      setDeleteLoading(false);
    }
  }, [loadLogs, page, pendingDelete, query, selected]);

  const cancelDelete = useCallback(() => {
    if (deleteLoading) return;
    setPendingDelete(null);
  }, [deleteLoading]);

  const closeCachedNotice = useCallback(() => {
    setCachedNotice(false);
  }, []);

  useEffect(() => {
    loadLogs(page, searchQuery);
  }, [page, searchQuery, loadLogs]);

  useEffect(() => {
    window.verifyInvoiceWithUpload = verifyInvoiceWithUpload;
    window.notifyInvoiceCached = () => setCachedNotice(true);
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
          displayQuery={searchQuery}
          onQueryChange={setQuery}
          onSearch={() => {
            const trimmed = String(query || '').trim();
            setSearchQuery(trimmed);
            setPage(1);
            loadLogs(1, trimmed);
          }}
          onClear={() => {
            setQuery('');
            setSearchQuery('');
            setPage(1);
            loadLogs(1, '');
          }}
          page={page}
          totalPages={totalPages}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
          onView={(record) => setSelected(record)}
          onDelete={handleDelete}
        />
      </main>
      <Drawer record={selected} onClose={() => setSelected(null)} />
      <div className={`modal-overlay${pendingDelete ? ' active' : ''}`} onClick={(e) => {
        if (e.target === e.currentTarget) cancelDelete();
      }}>
        <div className="modal">
          <div className="modal-header">确认删除</div>
          <div className="modal-body">
            确认删除发票 {pendingDelete ? `${pendingDelete.code || '—'} / ${pendingDelete.id || '—'}` : ''} 吗？
          </div>
          <div className="modal-actions">
            <button className="btn-view" onClick={cancelDelete} disabled={deleteLoading}>
              取消
            </button>
            <button className="btn-view btn-delete" onClick={confirmDelete} disabled={deleteLoading}>
              确认删除
            </button>
          </div>
        </div>
      </div>
      <div className={`modal-overlay${cachedNotice ? ' active' : ''}`} onClick={(e) => {
        if (e.target === e.currentTarget) closeCachedNotice();
      }}>
        <div className="modal">
          <div className="modal-header">提示</div>
          <div className="modal-body">此发票已经验真过</div>
          <div className="modal-actions">
            <button className="btn-view" onClick={closeCachedNotice}>
              我知道了
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
