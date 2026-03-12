#!/usr/bin/env node
/**
 * 用于验证 .env 配置文件的脚本。
 *
 * 用法：
 *    node validate_env.js
 *    node validate_env.js --strict  # 严格模式，检查所有配置
 *
 * 此脚本验证 .env 文件是否存在且包含必需的配置。
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 解析命令行参数
 */
function parseArgs() {
    const args = {
        strict: false,
        quiet: false
    };

    for (let i = 2; i < process.argv.length; i++) {
        const arg = process.argv[i];
        if (arg === '--strict') {
            args.strict = true;
        } else if (arg === '--quiet' || arg === '-q') {
            args.quiet = true;
        } else if (arg === '--help' || arg === '-h') {
            console.log(`
用法：
    node validate_env.js [选项]

选项：
    --strict        启用严格模式（检查所有可选配置）
    --quiet, -q     静默模式（只输出结果，不显示过程）
    --help, -h      显示此帮助信息
`);
            process.exit(0);
        }
    }

    return args;
}

/**
 * 查找 .env 文件（仅检查项目根目录）
 */
function findEnvFile() {
    const envFile = path.join(process.cwd(), '.env');
    return fs.existsSync(envFile) ? envFile : null;
}

/**
 * 读取 .env 文件内容
 */
function readEnvFile(envFile) {
    const config = {};
    try {
        const content = fs.readFileSync(envFile, 'utf-8');
        const lines = content.split('\n');

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('#')) {
                continue;
            }
            if (trimmedLine.includes('=')) {
                const [key, ...valueParts] = trimmedLine.split('=');
                config[key.trim()] = valueParts.join('=').trim();
            }
        }
    } catch (err) {
        console.log(`❌ 读取 .env 文件失败: ${err.message}`);
        return {};
    }

    return config;
}

/**
 * 验证 token 是否有效
 */
function validateToken(token) {
    if (!token) {
        return { valid: false, message: 'Token 为空' };
    }

    if (token === 'your-token-here') {
        return { valid: false, message: 'Token 未配置（仍为默认占位符）' };
    }

    if (token.length < 10) {
        return { valid: false, message: `Token 长度过短（${token.length} 字符）` };
    }

    return { valid: true, message: 'Token 格式有效' };
}

/**
 * 验证 API URL 是否有效
 */
function validateApiUrl(url) {
    if (!url) {
        return { valid: false, message: 'API URL 为空' };
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return { valid: false, message: 'API URL 必须以 http:// 或 https:// 开头' };
    }

    return { valid: true, message: 'API URL 格式有效' };
}

/**
 * 验证环境配置
 */
function validateEnv(strict = false) {
    const messages = [];
    let passed = true;

    console.log('🔍 正在检查 .env 文件...');
    const envFile = findEnvFile();

    if (!envFile) {
        messages.push('❌ 未找到 .env 文件');
        messages.push("   提示：运行 'node scripts/generate_env.js' 创建配置文件");
        return { passed: false, messages };
    }

    console.log(`✅ 找到 .env 文件: ${envFile}`);
    messages.push(`✅ .env 文件位置: ${envFile}`);

    console.log('\n🔍 正在读取配置...');
    const config = readEnvFile(envFile);

    if (Object.keys(config).length === 0) {
        messages.push('❌ .env 文件为空或格式错误');
        return { passed: false, messages };
    }

    console.log('\n🔍 正在检查必需配置...');

    const tokenKeys = ['VITE_AUTH_TOKEN', 'REACT_APP_AUTH_TOKEN', 'NODE_AUTH_TOKEN'];
    let token = null;
    let tokenKey = null;

    for (const key of tokenKeys) {
        if (config[key]) {
            token = config[key];
            tokenKey = key;
            break;
        }
    }

    if (!token) {
        messages.push('❌ 未找到身份验证令牌配置');
        messages.push(`   需要以下任一配置: ${tokenKeys.join(', ')}`);
        passed = false;
    } else {
        const result = validateToken(token);
        if (result.valid) {
            console.log(`✅ ${tokenKey}: ${result.message}`);
            messages.push(`✅ ${tokenKey}: ${result.message} (${token.length} 字符)`);
        } else {
            console.log(`❌ ${tokenKey}: ${result.message}`);
            messages.push(`❌ ${tokenKey}: ${result.message}`);
            passed = false;
        }
    }

    const apiUrlKeys = ['VITE_API_BASE_URL', 'REACT_APP_API_BASE_URL', 'NODE_API_BASE_URL'];
    let apiUrl = null;
    let apiUrlKey = null;

    for (const key of apiUrlKeys) {
        if (config[key]) {
            apiUrl = config[key];
            apiUrlKey = key;
            break;
        }
    }

    if (!apiUrl) {
        messages.push('⚠️  未找到 API 基础 URL 配置');
        messages.push(`   建议配置: ${apiUrlKeys.join(', ')}`);
        if (strict) {
            passed = false;
        }
    } else {
        const result = validateApiUrl(apiUrl);
        if (result.valid) {
            console.log(`✅ ${apiUrlKey}: ${result.message}`);
            messages.push(`✅ ${apiUrlKey}: ${apiUrl}`);
        } else {
            console.log(`❌ ${apiUrlKey}: ${result.message}`);
            messages.push(`❌ ${apiUrlKey}: ${result.message}`);
            passed = false;
        }
    }

    if (strict) {
        console.log('\n🔍 正在检查可选配置...');

        const timeoutKeys = ['VITE_REQUEST_TIMEOUT', 'REACT_APP_REQUEST_TIMEOUT', 'NODE_REQUEST_TIMEOUT'];
        let timeout = null;
        for (const key of timeoutKeys) {
            if (config[key]) {
                timeout = config[key];
                break;
            }
        }

        if (timeout) {
            messages.push(`ℹ️  请求超时: ${timeout}ms`);
        } else {
            messages.push('ℹ️  请求超时未配置（将使用默认值）');
        }

        const debugKeys = ['VITE_DEBUG', 'REACT_APP_DEBUG', 'NODE_DEBUG'];
        let debug = null;
        for (const key of debugKeys) {
            if (config[key]) {
                debug = config[key];
                break;
            }
        }

        if (debug) {
            messages.push(`ℹ️  调试模式: ${debug}`);
        } else {
            messages.push('ℹ️  调试模式未配置（将使用默认值）');
        }
    }

    return { passed, messages };
}

/**
 * 打印验证结果
 */
function printValidationResult(passed, messages) {
    console.log('\n' + '='.repeat(60));
    console.log('验证结果');
    console.log('='.repeat(60));

    for (const msg of messages) {
        console.log(msg);
    }

    console.log('\n' + '='.repeat(60));
    if (passed) {
        console.log('✅ 环境配置验证通过');
        console.log('='.repeat(60));
        console.log('\n可以开始使用 jetop-service 进行数据操作。');
    } else {
        console.log('❌ 环境配置验证失败');
        console.log('='.repeat(60));
        console.log('\n请修复上述问题后再使用 jetop-service。');
        console.log('\n💡 快速修复：');
        console.log("   1. 运行 'node scripts/generate_env.js' 创建配置文件");
        console.log('   2. 编辑 .env 文件，填入实际的令牌值');
        console.log('   3. 重新运行此脚本验证配置');
    }
}

/**
 * 主函数
 */
function main() {
    const args = parseArgs();

    if (!args.quiet) {
        console.log('🔧 jetop-service 环境配置验证器');
        console.log('='.repeat(60));
        console.log();
    }

    const { passed, messages } = validateEnv(args.strict);

    if (!args.quiet) {
        printValidationResult(passed, messages);
    }

    process.exit(passed ? 0 : 1);
}

try {
    main();
} catch (err) {
    console.log(`\n❌ 发生错误: ${err.message}`);
    process.exit(1);
}
