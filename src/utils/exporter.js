import * as XLSX from 'xlsx';

/**
 * 格式化发票数据为适合导出的平面对象阵列
 * @param {Array} records 内部结构化的发票记录列表
 */
const formatForExport = (records) => {
  return records.map((r, index) => {
    // 处理金额，去除非数字字符，仅保留数值进行正确的 Excel 数字格式化
    let rawAmount = 0;
    if (r.amount) {
      const amtStr = String(r.amount).replace(/[^0-9.-]+/g, '');
      rawAmount = parseFloat(amtStr);
      if (isNaN(rawAmount)) rawAmount = 0;
    }
    
    // 税额处理同样逻辑
    let taxAmt = 0;
    if (r.raw && r.raw.taxamount) {
      const taxStr = String(r.raw.taxamount).replace(/[^0-9.-]+/g, '');
      taxAmt = parseFloat(taxStr);
      if (isNaN(taxAmt)) taxAmt = 0;
    }

    return {
      '序号': index + 1,
      '发票代码': r.code,
      '发票号码': r.id,
      '开票日期': r.invoiceDate,
      '购买方名称': r.buyer,
      '购买方税号': r.raw?.gfNsrsbh || '',
      '销售方名称': r.seller,
      '销售方税号': r.raw?.xfNsrsbh || '',
      '发票类型': r.type,
      '价税合计(元)': rawAmount,
      '不含税金额(元)': Number((rawAmount - taxAmt).toFixed(2)),
      '税额(元)': taxAmt,
      '查验状态': r.status === 'success' ? '查验通过' : '查验异常',
      '备注': r.raw?.remark || '',
      '上传时间': r.uploadTime
    };
  });
};

/**
 * 触发客户端文件下载 Excel (.xlsx)
 * @param {Array} records 选中的发票记录
 * @param {String} filename 导出的文件名，不含后缀
 */
export const downloadExcel = (records, filename = '发票明细导出') => {
  if (!records || records.length === 0) return;

  // 1. 转换数据
  const exportData = formatForExport(records);

  // 2. 创建工作簿和工作表
  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '发票数据');

  // 3. 调整列宽 (可选的简单自适应)
  const cols = [
    { wch: 6 },  // 序号
    { wch: 16 }, // 发票代码
    { wch: 12 }, // 发票号码
    { wch: 12 }, // 开票日期
    { wch: 30 }, // 购买方
    { wch: 20 }, // 购买税号
    { wch: 30 }, // 销售方
    { wch: 20 }, // 销售税号
    { wch: 15 }, // 类型
    { wch: 12 }, // 价税合计
    { wch: 12 }, // 不含税金额
    { wch: 10 }, // 税额
    { wch: 10 }, // 状态
    { wch: 20 }, // 备注
    { wch: 20 }  // 上传时间
  ];
  worksheet['!cols'] = cols;

  // 4. 导出为文件
  XLSX.writeFile(workbook, `${filename}_${new Date().getTime()}.xlsx`);
};
