import fs from 'fs';
import path from 'path';

let config = '';

let commandPath = process.argv[1];
let scriptDir = path.parse(commandPath).dir;
let configFilePath = path.join(scriptDir, 'jenkins.json');

function loadConfig() {
    if (!configFilePath) {
        throw new Error('Config file not available');
    }
    
    const configData = fs.readFileSync(configFilePath, 'utf8');
    config = JSON.parse(configData);
    return config;
}

/**
 * Save changes to JSON file
 * @param {*} config parsed config
 */
function updateConfig(config) {
    fs.writeFileSync(configFilePath, JSON.stringify(config, null, 4), {flags: 'w+'});
}

/**
 * Save user authentication information to config file
 * @param {Object} config parsed config
 * @param {string} crumb authentication token after login
 */
function saveUserAuthToken(config, crumb) {
    config.userInfo.crumb = crumb;
    updateConfig(config);
}

function saveCurrentJobRuns(config, pipeLineName, repoName, branchName, branchOption) {
    config.previousJobRun.pipeLineName = pipeLineName;
    config.previousJobRun.branchName = branchName;
    config.previousJobRun.branchOption = branchOption;
    config.previousJobRun.repoName = repoName;
    updateConfig(config);
}

/**
 * Save user information after successful login
 * @param {Object} config parsed config
 * @param {string} fullName name of the user
 * @param {string} email email of the user
 */
function saveUserInfo(config, fullName, email) {
    config.userInfo.userName = fullName;
    config.userInfo.email = email;
    updateConfig(config);
}

export {
    loadConfig,
    updateConfig,
    saveUserAuthToken,
    saveCurrentJobRuns,
    saveUserInfo
}