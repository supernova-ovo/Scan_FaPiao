#!/usr/bin/env node
/**
 * 用于检索和显示 jetop-service 区块 ID 架构的脚本（使用 Node.js HTTP 模块）
 *
 * 用法：
 *     node get_schema.js <section-id>
 *     node get_schema.js <section-id> --output json
 *     node get_schema.js <section-id> --output table
 *     node get_schema.js <section-id> --output summary
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 加载 .env 文件
 */
function loadEnv() {
    const envPath = path.resolve(process.cwd(), '.env');

    if (!fs.existsSync(envPath)) {
        throw new Error('未找到 .env 文件');
    }

    const envContent = fs.readFileSync(envPath, 'utf-8');
    const envVars = {};

    envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...valueParts] = trimmed.split('=');
            const value = valueParts.join('=').trim();
            if (key && value) {
                envVars[key.trim()] = value;
            }
        }
    });

    return envVars;
}

/**
 * 构建 multipart/form-data 请求体
 */
function buildMultipartFormData(fields) {
    const boundary = `----FormBoundary${Date.now()}${Math.random().toString(36).substring(2)}`;
    const parts = [];

    for (const [name, value] of Object.entries(fields)) {
        parts.push(`--${boundary}\r\n`);
        parts.push(`Content-Disposition: form-data; name="${name}"\r\n\r\n`);
        parts.push(`${value}\r\n`);
    }

    parts.push(`--${boundary}--\r\n`);

    return {
        boundary,
        body: parts.join('')
    };
}

/**
 * 发起 HTTPS 请求
 */
function httpsRequest(url, options, postData) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);

        const requestOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.pathname,
            method: options.method || 'POST',
            headers: options.headers || {},
            rejectUnauthorized: false
        };

        const req = https.request(requestOptions, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data);
                } else {
                    reject(new Error(`HTTP错误: ${res.statusCode} ${res.statusMessage}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (postData) {
            req.write(postData);
        }

        req.end();
    });
}

/**
 * 发起请求到 sectionHandler API
 */
async function apiRequest(apiUrl, authToken, formFields) {
    const url = `${apiUrl}/ks/sectionHandler.ashx`;
    const { boundary, body } = buildMultipartFormData(formFields);

    const options = {
        method: 'POST',
        headers: {
            'X-JetopDebug-User': authToken,
            'host': 'localhost',
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': Buffer.byteLength(body)
        }
    };

    const responseText = await httpsRequest(url, options, body);
    return JSON.parse(responseText);
}

/**
 * 查询区块数据
 */
async function getSectionData(apiUrl, authToken, sectionId, where = {}) {
    const formFields = {
        id: sectionId,
        mode: 'query',
        _pageindex: '1',
        _pagesize: '100'
    };

    for (const [key, value] of Object.entries(where)) {
        if (key.startsWith('_p_')) {
            formFields[key] = value;
        } else if (key.startsWith('where_')) {
            const paramName = key.substring(6);
            formFields[`_p_${paramName}`] = value;
        } else {
            formFields[`_p_${key}`] = value;
        }
    }

    try {
        const response = await apiRequest(apiUrl, authToken, formFields);

        if (response.STATUS === 'Success' || response.STATUS === 'OK') {
            return response.ROWS || [];
        }
        return [];
    } catch (error) {
        console.error(`查询区块数据失败 [${sectionId}]:`, error.message);
        return [];
    }
}

/**
 * 转换数据为架构
 */
function convertDataToScheme(tableScheme, oldScheme, dbinfo) {
    if (!tableScheme || tableScheme.length === 0) {
        return [];
    }

    const scheme = [];
    let index = 0;

    const firstRow = tableScheme[0];
    const keys = Object.keys(firstRow);

    for (const key of keys) {
        if (key === 'sys_id' || key === 'data_id') {
            continue;
        }

        index++;

        const oldField = oldScheme.find(f => f.ZiDuanMC === key);

        if (oldField) {
            scheme.push({
                XuHao: index,
                ZiDuanMC: key,
                ZiDuanMS: oldField.ZiDuanMS || key,
                ShuJuLX: oldField.ShuJuLX || 'nvarchar',
                ZiDuanCD: oldField.ZiDuanCD || 50,
                JingDu: oldField.JingDu || 0,
                YunXuKZ: oldField.YunXuKZ || 'Y',
                MoRenZ: oldField.MoRenZ || '',
                data_id: dbinfo.id || '',
                sys_id: `${dbinfo.id || ''}-${key}`
            });
        } else {
            scheme.push({
                XuHao: index,
                ZiDuanMC: key,
                ZiDuanMS: key,
                ShuJuLX: 'nvarchar',
                ZiDuanCD: 50,
                JingDu: 0,
                YunXuKZ: 'Y',
                MoRenZ: '',
                data_id: dbinfo.id || '',
                sys_id: `${dbinfo.id || ''}-${key}`
            });
        }
    }

    return scheme;
}

/**
 * 获取准确的区块架构
 */
async function getSchemeAccurate(apiUrl, authToken, sectionId) {
    try {
        console.error(`正在获取区块架构: ${sectionId}`);
        console.error('');

        console.error('步骤1: 查询区块数据源信息...');
        const result = await getSectionData(
            apiUrl,
            authToken,
            'd8879104-fc53-4509-97e4-da4aea628c12',
            { '_p_sid': sectionId }
        );

        if (!result || result.length === 0) {
            throw new Error('未找到区块信息');
        }

        const dbinfo = result[0];
        const dbId = dbinfo.id;
        const dsType = dbinfo.dsType || '';

        console.error(`  数据源ID: ${dbId}`);
        console.error(`  数据源类型: ${dsType}`);
        console.error('');

        console.error('步骤2: 查询字段架构信息...');
        const scheme = await getSectionData(
            apiUrl,
            authToken,
            '2d89f7b7-8be8-4d90-9500-fb3cd96c8c92',
            { '_p_did': dbId }
        );

        console.error(`  找到 ${scheme.length} 个字段定义`);

        if (dsType === '表视图') {
            console.error('  数据源类型为表视图，直接返回架构');
            console.error('');
            return scheme;
        }

        console.error('步骤3: 查询实际数据（查询类型需要）...');
        const data = await getSectionData(
            apiUrl,
            authToken,
            '9c88c101-e30f-4d2c-ac06-63cd61227250',
            { '_p_did': dbId }
        );

        if (!data || data.length === 0) {
            console.error('  警告：未找到查询数据，返回基础架构');
            return scheme;
        }

        console.error(`  查询到 ${data.length} 条数据`);
        console.error('步骤4: 转换架构...');

        const convertedScheme = convertDataToScheme(data, scheme, dbinfo);
        console.error(`  最终架构包含 ${convertedScheme.length} 个字段`);
        console.error('');

        return convertedScheme;

    } catch (error) {
        console.error(`获取区块架构失败: ${error.message}`);
        return [];
    }
}

/**
 * 格式化为表格
 */
function formatTable(scheme) {
    if (!scheme || scheme.length === 0) {
        return '未找到架构数据';
    }

    const rows = [];
    rows.push('');
    rows.push('#    字段名称                           描述                             类型         长度       精度         允许空值        默认值            ');
    rows.push('-'.repeat(130));

    scheme.forEach(field => {
        const xuHao = String(field.XuHao || '').padEnd(4);
        const ziDuanMC = String(field.ZiDuanMC || '').padEnd(30);
        const ziDuanMS = String(field.ZiDuanMS || '').padEnd(30);
        const shuJuLX = String(field.ShuJuLX || '').padEnd(10);
        const ziDuanCD = String(field.ZiDuanCD || '').padEnd(8);
        const jingDu = String(field.JingDu || '').padEnd(10);
        const yunXuKZ = String(field.YunXuKZ || '').padEnd(13);
        const moRenZ = String(field.MoRenZ || '').padEnd(15);

        rows.push(`${xuHao} ${ziDuanMC} ${ziDuanMS} ${shuJuLX} ${ziDuanCD} ${jingDu} ${yunXuKZ} ${moRenZ}`);
    });

    return rows.join('\n');
}

/**
 * 格式化为 JSON
 */
function formatJson(scheme) {
    return JSON.stringify(scheme, null, 2);
}

/**
 * 格式化为摘要
 */
function formatSummary(scheme) {
    if (!scheme || scheme.length === 0) {
        return '未找到架构数据';
    }

    const totalFields = scheme.length;
    const requiredFields = scheme.filter(f => f.YunXuKZ === 'N').length;
    const optionalFields = totalFields - requiredFields;

    const typeCounts = {};
    scheme.forEach(field => {
        const fieldType = field.ShuJuLX || 'unknown';
        typeCounts[fieldType] = (typeCounts[fieldType] || 0) + 1;
    });

    const lines = [
        '架构摘要',
        '='.repeat(50),
        `总字段数：${totalFields}`,
        `必填字段：${requiredFields}`,
        `可选字段：${optionalFields}`,
        '',
        '字段类型：'
    ];

    for (const [fieldType, count] of Object.entries(typeCounts)) {
        lines.push(`  - ${fieldType}: ${count}`);
    }

    lines.push('');
    lines.push('必填字段：');
    scheme.forEach(field => {
        if (field.YunXuKZ === 'N') {
            lines.push(`  - ${field.ZiDuanMC} (${field.ZiDuanMS})`);
        }
    });

    return lines.join('\n');
}

/**
 * 主函数
 */
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
        console.log('用法：');
        console.log('  node get_schema.js <section-id>');
        console.log('  node get_schema.js <section-id> --output json');
        console.log('  node get_schema.js <section-id> --output table');
        console.log('  node get_schema.js <section-id> --output summary');
        process.exit(0);
    }

    const sectionId = args[0];
    let outputFormat = 'table';

    const outputIndex = args.indexOf('--output');
    if (outputIndex !== -1 && args[outputIndex + 1]) {
        outputFormat = args[outputIndex + 1];
    }

    try {
        const envVars = loadEnv();
        const apiUrl = envVars.VITE_API_BASE_URL || 'https://test1.tepc.cn/jetopcms';
        const authToken = envVars.VITE_AUTH_TOKEN || '';

        if (!authToken || authToken === 'your-token-here') {
            throw new Error('AUTH_TOKEN 未正确配置');
        }

        const scheme = await getSchemeAccurate(apiUrl, authToken, sectionId);

        if (!scheme || scheme.length === 0) {
            console.error('未找到架构数据');
            process.exit(1);
        }

        let output;
        switch (outputFormat) {
            case 'json':
                output = formatJson(scheme);
                break;
            case 'summary':
                output = formatSummary(scheme);
                break;
            case 'table':
            default:
                output = formatTable(scheme);
                break;
        }

        console.log(output);

    } catch (error) {
        console.error(`错误：${error.message}`);
        process.exit(1);
    }
}

main();
