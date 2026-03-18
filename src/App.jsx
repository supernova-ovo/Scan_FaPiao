import { useCallback, useEffect, useMemo, useState } from 'react';
import Header from './components/Header.jsx';
import StatsGrid from './components/StatsGrid.jsx';
import UploadSection from './components/UploadSection.jsx';
import InvoiceTable from './components/InvoiceTable.jsx';
import Drawer from './components/Drawer.jsx';
import { fetchScanLogs, fetchStats, markScanLogDeleted, markScanLogBatchDeleted, verifyInvoiceWithUpload } from './services/api.js';
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
  const [showBatchDelete, setShowBatchDelete] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [toastMsg, setToastMsg] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / pageSize)), [totalCount]);

  const loadLogs = useCallback(async (pageIndex, searchQuery) => {
    try {
      setIsLoading(true);
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
      setSelectedKeys([]); // Clear selection on load
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
    } finally {
      setIsLoading(false);
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
      setSelectedKeys((prev) => prev.filter((k) => k !== pendingDelete.key));
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
    
    const onShowToast = (e) => {
      setToastMsg(e.detail);
      setTimeout(() => setToastMsg(null), 3000);
    };
    window.addEventListener('show-toast', onShowToast);
    return () => window.removeEventListener('show-toast', onShowToast);
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
    // 处理完成后，刷新一次列表和统计数据，确保计数自动增加
    loadLogs(page, searchQuery);
  };

  const handleSelectRow = useCallback((key, isSelected) => {
    setSelectedKeys((prev) =>
      isSelected ? [...prev, key] : prev.filter((k) => k !== key)
    );
  }, []);

  const handleSelectAll = useCallback((isSelected) => {
    if (isSelected) {
      setSelectedKeys(records.filter(r => r.status !== 'processing').map(r => r.key));
    } else {
      setSelectedKeys([]);
    }
  }, [records]);

  const handleBatchDelete = useCallback(() => {
    if (!selectedKeys.length) return;
    setShowBatchDelete(true);
  }, [selectedKeys.length]);

  const confirmBatchDelete = useCallback(async () => {
    if (!selectedKeys.length) return;
    try {
      setError('');
      setDeleteLoading(true);
      const res = await markScanLogBatchDeleted(selectedKeys);
      if (!res || res.STATUS === 'Error') {
        setError('批量删除失败');
        return;
      }
      setRecords((prev) => prev.filter((item) => !selectedKeys.includes(item.key)));
      setSelectedKeys([]);
      setShowBatchDelete(false);
      setToastMsg('批量删除执行完成');
      loadLogs(page, searchQuery);
    } catch (e) {
      setError('批量删除过程中发生错误');
      console.warn('batch delete failed', e);
    } finally {
      setDeleteLoading(false);
    }
  }, [selectedKeys, page, searchQuery, loadLogs]);

  const cancelBatchDelete = useCallback(() => {
    if (deleteLoading) return;
    setShowBatchDelete(false);
  }, [deleteLoading]);

  const handleBatchExport = useCallback(() => {
    if (!selectedKeys.length) return;
    
    // 获取选中项的详细数据（用于导出）
    const selectedRecords = records.filter(r => selectedKeys.includes(r.key));
    const rowIds = selectedRecords.map(r => r.rowId).filter(Boolean);
    
    if (rowIds.length === 0) {
      setToastMsg('选中项中没有可导出的有效记录');
      return;
    }

    setToastMsg(`正在请求导出 ${rowIds.length} 项发票数据...`);
    
    // 模拟或调用后端导出接口
    console.log('[Batch Export] Selected Row IDs:', rowIds);
    // window.location.href = `${appConfig.exportUrl}?ids=${rowIds.join(',')}`;
  }, [selectedKeys, records]);

  return (
    <div className="app-container">
      <Header />
      <main>
        <StatsGrid total={stats.total} success={stats.success} fail={stats.fail} />
        <UploadSection onFiles={handleFiles} isCompact={records.length > 0} />
        {error ? <div className="error-hint">{error}</div> : null}
        <InvoiceTable
          records={records}
          isLoading={isLoading}
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
          selectedKeys={selectedKeys}
          onSelectRow={handleSelectRow}
          onSelectAll={handleSelectAll}
          onBatchDelete={handleBatchDelete}
          onBatchExport={handleBatchExport}
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
      <div className={`modal-overlay${showBatchDelete ? ' active' : ''}`} onClick={(e) => {
        if (e.target === e.currentTarget) cancelBatchDelete();
      }}>
        <div className="modal">
          <div className="modal-header">确认批量删除</div>
          <div className="modal-body">
            确认批量删除选中的 {selectedKeys.length} 项发票记录吗？<br />
            注意：此操作不可撤销，请谨慎操作。
          </div>
          <div className="modal-actions">
            <button className="btn-view" onClick={cancelBatchDelete} disabled={deleteLoading}>
              取消
            </button>
            <button className="btn-view btn-delete" onClick={confirmBatchDelete} disabled={deleteLoading}>
              确认批量删除
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
      
      {toastMsg && (
        <div className="toast-message">
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
};

export default App;
