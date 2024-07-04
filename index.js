import inquirer from "inquirer";
import chalk from 'chalk';
import _ from 'lodash';
import { Table } from "console-table-printer";
import moment from "moment";
import * as fsUtil from "./file-system/index.js";
import * as prompts from "./prompts/index.js";
import * as web from "./web/index.js";
import * as ui from "./ui/index.js";
import inquirerSearchList from "inquirer-search-list";
inquirer.registerPrompt("search-list", inquirerSearchList);

let config = '';
let repoOption = '';
let branchOption = '';
let branchName = '';
let pipeLineName = '';
let jobNumber = '';
let urls = {
    userDetails: "me/api/json",
    generateAuthToken: 'crumbIssuer/api/json',
    pipeLineJobs: "job/{pipeLineName}/api/json?tree=jobs[name]",
    jobRuns: "job/{pipeLineName}/job/{branchName}/wfapi/runs",
    jobRun: "job/{pipeLineName}/job/{branchName}/{jobId}/api/json",
    jobConsoleText: "job/{pipeLineName}/job/{branchName}/{jobNumber}/consoleText",
    listDeployments: "job/{pipeLineName}/buildWithParameters?",
    buildFromQueue: "job/{pipeLineName}/api/json?tree=builds[id,number,result,queueId]",
    promotions: "job/{pipeLineName}/buildWithParameters?"
};
let errorsToConsider = [
    ".*?ERROR:.*?",
    ".*?java\.lang\.Exception:.*?",
    ".*?ABORTED.*?",
    ".*?script\sreturned\sexit\scode\s143.*?",
    ".*?error.*?"
];
let deploymentsKeywords = [
    ".*?azurecr.*?"
];

async function getJobErrors(config, pipeLineName, branchName, jobNumber) {
    let jobConsoleTextUrl = urls.jobConsoleText.replace("{pipeLineName}", pipeLineName)
    .replace("{branchName}", branchName)
    .replace("{jobNumber}", jobNumber);

    let jobConsoleTextResponse = await web.makeRequest(jobConsoleTextUrl, "POST", config, false);
    // console.log(jobConsoleTextResponse);
    let errorRegex = `(${errorsToConsider.join('|')})\n`;
    let errorsList = jobConsoleTextResponse.matchAll(errorRegex);
    for (let error of errorsList) {
        console.log(chalk.red.bold(error[1]));
    }
}

async function getRunChangeSets(config, pipeLineName, branchName, jobId) {
    let jobRunUrl = urls.jobRun
    .replace("{pipeLineName}", pipeLineName)
    .replace("{branchName}", branchName)
    .replace("{jobId}", jobId);
    
    let commits = [];
    try {
        let jobRunResponse = await web.makeRequest(jobRunUrl, "POST", config, false);
        if (_.get(jobRunResponse, 'changeSets', []).length > 0) {
            let changeSets = _.get(jobRunResponse, 'changeSets[0].items', []);
            commits = changeSets.map((change) => {
                return {
                    'msg': change.msg,
                    'author': change.author.fullName,
                    'timestamp': change.timestamp
                }
            });
            // console.log('commits', commits);
        }    
    } catch (error) {
        console.log(chalk.red(`An error occurred while getting change sets for job ${jobId}`));
    }
    
    return commits;
}

async function processRun(runItem) {
    let runInfo = {};
    // console.log(runItem);
    let jobId = _.get(runItem, 'id');
    let commits = [];
    if (!_.includes(config.excludePipeLinesForCommits, pipeLineName)) {
        commits = await getRunChangeSets(config, pipeLineName, branchOption, jobId);
    }
    // console.log(commits);
    let name = _.get(runItem, 'name');
    let status = _.get(runItem, 'status');
    let stages = _.get(runItem, 'stages');
    runInfo.name = name;
    runInfo.status = status;
    runInfo.commits = commits;
    runInfo.stages = [];
    // console.log(runInfo);
    
    for (let j in stages) {
        let stageInfo = {};
        let stageItem = stages[j];
        let stageName = _.get(stageItem, 'name');
        let stageStatus = _.get(stageItem, 'status');
        let stageDuration = _.get(stageItem, 'durationMillis');
        let stateDurationParsed = moment.duration(stageDuration);
        let stageDurationHumanRedable = `${stateDurationParsed.minutes()}m ${stateDurationParsed.seconds()}s`;
        stageInfo.stageName = stageName;
        stageInfo.stageStatus = stageStatus;
        stageInfo.stageDuration = stageDurationHumanRedable;
        runInfo.stages.push(stageInfo);
    }
    return runInfo;
}

async function getJobRuns(config, pipeLineName, branchName) {
    let jobRunsUrl = (branchName) ? urls.jobRuns.replace("{pipeLineName}", pipeLineName).replace("{branchName}", branchName) : urls.jobRuns.replace("{pipeLineName}", pipeLineName).replace("job/{branchName}/", branchName);
    let jobRunsResponse = await web.makeRequest(jobRunsUrl, "POST", config, false);
    let runsToConsider = 5;
    let runsInfo = [];
    const filteredRuns = Object.values(jobRunsResponse).slice(0, runsToConsider);
    for (let i in filteredRuns) {
        let runItem = filteredRuns[i];
        let processedRunItem = await processRun(runItem);
        runsInfo.push(processedRunItem);
    }
    
    // Print run information
    for (let i in runsInfo) {
        let runItem = runsInfo[i];
        ui.printRun(runItem);
    }
}

async function getJobConsoleText(config, pipeLineName, branchName, jobNumber) {
    let jobConsoleTextUrl = (branchName) ? urls.jobConsoleText.replace("{pipeLineName}", pipeLineName)
    .replace("{branchName}", branchName)
    .replace("{jobNumber}", jobNumber) : urls.jobConsoleText.replace("{pipeLineName}", pipeLineName)
    .replace("job/{branchName}/", branchName)
    .replace("{jobNumber}", jobNumber);

    let jobConsoleTextResponse = await web.makeRequest(jobConsoleTextUrl, "POST", config, false);
    return jobConsoleTextResponse;
}

async function promotions(config, pipeLineName, promotionsInputs, isBulk) {
    let query = new URLSearchParams(promotionsInputs);
    let promotionsUrl = urls.promotions.replace("{pipeLineName}", pipeLineName) + query;
    // console.log(promotionsUrl);
    let promotionsResponse = await web.makeRequest(promotionsUrl, "POST", config, false);
    // console.log(promotionsResponse);
    if (promotionsResponse.status === 201) {
        console.log(chalk.green.bold((isBulk) ? 'Bulk Promoted': 'Promoted'));
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function getListDeployments(config, pipeLineName, listDeploymentsInputs) {
    listDeploymentsInputs.NAMESPACE = 'production';
    listDeploymentsInputs.COLUMNS = 'IMAGE';
    let query = new URLSearchParams(listDeploymentsInputs);
    let listDeploymentsUrl = urls.listDeployments.replace("{pipeLineName}", pipeLineName);
    listDeploymentsUrl = listDeploymentsUrl + query;
    let listDeploymentsJobsResponse = await web.makeRequest(listDeploymentsUrl, "POST", config, false);
    if (listDeploymentsJobsResponse.status === 201) {
        console.log(chalk.green.bold("Job Created Successfully"));
        let queueUrl = listDeploymentsJobsResponse.headers.location;
        const queueUrlObject = new URL(queueUrl);
        let queueUrlPath = queueUrlObject.pathname;
        const queueId = queueUrlPath.split('/')[3];
        console.log(chalk.green.bold(`Job Created with queue Id: ${queueId}`));
        console.log(chalk.green('Waiting for 13 seconds for job to be created and run'));
        await sleep(13000);
        console.log(chalk.green(`Getting job based on queue Id: ${queueId}`));
        let buildFromQueueUrl = urls.buildFromQueue.replace("{pipeLineName}", pipeLineName);
        let buildFromQueueResponse = await web.makeRequest(buildFromQueueUrl, "GET", config, false);
        let builds = buildFromQueueResponse.builds;
        let build = builds.find((build) => build.queueId === parseInt(queueId));
        if (build && build.number) {
            let jobId = build.number; // id (string)
            console.log(chalk.green.bold(`Created Job Id ${jobId}`));
            console.log(chalk.green.bold(`Getting job console text`));
            let listDeploymentsConsoleText = await getJobConsoleText(config, pipeLineName, '', jobId);
            let listRegex = `(${deploymentsKeywords.join('|')})\n`;
            let listDeployments = listDeploymentsConsoleText.matchAll(listRegex);
            let deployments = [];
            for (let listDeployment of listDeployments) {
                deployments.push(listDeployment[1]);
            }
            const parsedDeployments = deployments.map((item, index) => {
                const deployment = item.split('/')[1];
                const ms = deployment.split(':')[0];
                const remaining = deployment.split(':')[1];
                const tag = remaining.split('-')[1];
                return {Serial: index+ 1, Microservice: ms, Tag: tag, Color: (index%2 == 0) ? "green" : "white"};
            });
            
            const deploymentsTable = new Table({
                columns: [
                    { name: "Serial", alignment: "left" },
                    { name: "Microservice", alignment: "left" },
                    { name: "Tag", alignment: "left" }
                ]
            });
            _.forEach(parsedDeployments, (deployment) => {
                let data = {Serial: deployment.Serial, Microservice: deployment.Microservice, Tag: deployment.Tag};
                let color = {color: deployment.Color};
                deploymentsTable.addRow(data, color);
            });
            deploymentsTable.printTable();
        }
    }
}

/**
 * Fetches user information from jenkins and saves them to config and also prints them
 * @param {Object} config parsed config
 */
async function getUserDetails(config) {
    let userDetails = await web.makeRequest(urls.userDetails, "POST", config, false);
    let email = userDetails.property[4].address;
    let fullName = userDetails.fullName;
    return {email, fullName};
}

async function getBulkTags(config, bulkTagsPipeLines) {
    let bulkTagsInfo = {};
    for (let repoName of _.keys(bulkTagsPipeLines)) {
        bulkTagsInfo[repoName] = {};
        let pipeLineInfo = bulkTagsPipeLines[repoName];
        let branches = pipeLineInfo.branches;
        for (let branchInfo of branches) {
            let branchName = branchInfo.name;
            let branchRawName = branchInfo.raw;
            bulkTagsInfo[repoName][branchName] = '';
            let pipeLineName = config.pipeLineList.find(item => item.repo === repoName).name;
            let jobRunsUrl = urls.jobRuns.replace("{pipeLineName}", pipeLineName).replace("{branchName}", branchRawName);
            let jobRunsResponse = await web.makeRequest(jobRunsUrl, "POST", config, false);
            _.forEach(jobRunsResponse, (runItem) => {
                let stages = runItem.stages;
                let deployedStage = stages.filter(item => item.name.includes('Deploy to'));
                let tag = (deployedStage) ? deployedStage[0].name.split(' ')[3] : '';
                // console.log(repoName, branchName, runItem.name, tag);
                bulkTagsInfo[repoName][branchName] = `${runItem.name} - ${tag}`;
                return;
            })
        }
    }

    const bulkTagsItems = _.keys(bulkTagsInfo).map((key, index) => {
        return {Serial: index+ 1, 'Micro Service': key, ...bulkTagsInfo[key], Color: (index%2 == 0) ? "green" : "white"};
    });
    const bulkTagsTable = new Table({});
    _.forEach(bulkTagsItems, (bulkTagsItem) => {
        let color = {color: bulkTagsItem.Color};
        delete bulkTagsItem.Color;
        let data = {...bulkTagsItem};
        bulkTagsTable.addRow(data, color);
    });
    bulkTagsTable.printTable();
}

async function updateRepoBranches(pipeLineList, config) {
    console.log('Updating all repo branches');
    let excludeList = config.excludedPipeLines;
    let repoBranches = {};
    for(let pipeLineItem of pipeLineList) {
        let name = pipeLineItem.name;
        let repo = pipeLineItem.repo;
        let isIncluded = !_.includes(excludeList, name);
        if (isIncluded) {
            let pipeLineBranches = await getPipeLineJobs(name, config)
            repoBranches[repo] = pipeLineBranches;
        }
    }
    config.repoBranches = repoBranches;
    fsUtil.updateConfig(config);
    console.log("Updated all repos with branches");
}

async function getPipeLineJobs(pipeLineName, config) {
    let pipeLineJobsUrl = urls.pipeLineJobs.replace("{pipeLineName}", pipeLineName);
    let pipeLineJobsResponse = await web.makeRequest(pipeLineJobsUrl, "POST", config, false);
    let pipeLineJobs = pipeLineJobsResponse.jobs;
    let pipeLineJobNames = pipeLineJobs.reduce((accumulator, item) => ({...accumulator, [item.name]: decodeURIComponent(item.name)}), {});
    return pipeLineJobNames;
}

async function handleRunActions(runActions = ['Get Runs', 'Get Errors', 'Get Console Text', 'Exit'], defaultForRun) {
    let actionInquirerList = [
        {
            type: 'list',
            name: 'runOption',
            message: 'Please choose your action: ',
            choices: runActions,
            default: defaultForRun
        }
    ]
    let actionAnswers = await inquirer.prompt(actionInquirerList);
    let runOption = actionAnswers.runOption;

    if (runOption === 'Get Runs') {
        getJobRuns(config, pipeLineName, branchOption);
    } else if (runOption === 'Get Errors') {
        const jobNumberAnswer = await inquirer.prompt([{ type: 'input', name: 'jobNumber', message: 'Input Job Number:' }]);
        jobNumber = jobNumberAnswer.jobNumber;
        getJobErrors(config, pipeLineName, branchOption, jobNumber);
    } else if (runOption === 'Get Console Text') {
        const jobNumberAnswer = await inquirer.prompt([{ type: 'input', name: 'jobNumber', message: 'Input Job Number:' }]);
        jobNumber = jobNumberAnswer.jobNumber;
        let jobConsoleTextResponse = await getJobConsoleText(config, pipeLineName, branchOption, jobNumber);
        console.log(jobConsoleTextResponse);
    } else if (runOption === 'Promotions') {
        let promotionsInputs = await prompts.promotions();
        promotions(config, pipeLineName, promotionsInputs, false);
    } else if (runOption === 'Bulk Promotions') {
        let bulkPromotionsInputs = await prompts.bulkPromotions();
        promotions(config, pipeLineName, bulkPromotionsInputs, true)
    } else if (runOption === 'List Deployments') {
        let listDeploymentsInputs = await prompts.listDeployments();
        getListDeployments(config, pipeLineName, listDeploymentsInputs);
    } else if (runOption === 'Exit') {
        console.log("Exiting...");
        process.exit(0);
    }
}

async function branchPick(repoBranches, branchesRawList) {
    let branchData = {};
    let branchInquirerList = [
        {
            type: 'search-list',
            name: 'branchOption',
            message: 'Please choose your branch: ',
            choices: branchesRawList,
        }
    ];
    let branchesAnswers = await inquirer.prompt(branchInquirerList);
    branchOption = branchesAnswers.branchOption;
    branchData.name = branchOption;
    let branches = _.values(repoBranches);
    let branchIndex = branches.indexOf(branchOption);
    let branchOptionRaw = _.keys(repoBranches)[branchIndex];
    branchData.option = branchOptionRaw;
    
    return branchData;
}

/**
 * Generates auth token from jenkins based on object Id and app token
 * @param {Object} config parsed config
 * @returns {string} authenticated user token
 */
async function getUserAuthToken(config) {
    let tokenResponse = await web.makeRequest(urls.generateAuthToken, "GET", config, true);
    return tokenResponse.crumb;
}

async function checkUserInfo(config) {
    if (!config.userInfo.userName && !config.userInfo.appToken) {
        console.log();
        console.log(chalk.red.bold('User information is not available, please provide it in config.json'));
        console.log(chalk.red.bold('Exiting...'));
        process.exit(0);
    }
    if (!config.userInfo.crumb) {
        console.log();
        console.log(chalk.red.bold('User is currently not logged in'));
        console.log(chalk.green.bold('Logging in...'));
        let crumb = await getUserAuthToken(config);
        fsUtil.saveUserAuthToken(config, crumb);
        
        if (!crumb || crumb === null || crumb === undefined) {
            console.log(chalk.red.bold('No auth token available'));
            console.log(chalk.red.bold('Exiting...'));
            return;
        } else {
            let {email, fullName} = await getUserDetails(config);
            fsUtil.saveUserInfo(config, fullName, email);
            console.log(chalk.white("Logged in as"));
            ui.processUserDetails(fullName, email);
        }
    } else {
        console.log(chalk.white('Already logged in as'));
        ui.processUserDetails(config.userInfo.userName, config.userInfo.email);
        console.log();
    }
}

try {
    config = fsUtil.loadConfig();

    // Check if config file has enough user information
    await checkUserInfo(config);

    let pipeLineList = config.pipeLineList;
    let repoListNames = pipeLineList.map(item => item.repo);

    let repoInquirerList = [
        {
            type: 'search-list',
            name: 'repoOption',
            message: 'Please choose your repo: ',
            choices: repoListNames,
        }
    ]
    let repoAnswers = await inquirer.prompt(repoInquirerList);
    repoOption = repoAnswers.repoOption;
    let repoIndex = repoListNames.indexOf(repoOption);

    if (repoOption === 'Exit') {
        console.log(chalk.red.bold('Exiting...'));
        process.exit(0);
    } else if (repoOption === 'Update repo branches') {
        updateRepoBranches(pipeLineList, config)
    } else if (repoOption === 'Run Previous Job') {
        pipeLineName = config.previousJobRun.pipeLineName;
        let repoName = config.previousJobRun.repoName;
        let branchName = config.previousJobRun.branchName;
        branchOption = config.previousJobRun.branchOption;
        if (pipeLineName && branchOption) {
            ui.printCurrentJobInfo(repoName, branchName);
            getJobRuns(config, pipeLineName, branchOption);
        } else {
            console.log(chalk.red.bold("Previous job information not available"));
        }
    } else {
        pipeLineName = _.get(pipeLineList, `[${repoIndex}].name`, '');
        let runActions = ['Get Runs', 'Get Errors', 'Get Console Text', 'Exit'];
        let defaultForRun = "";
        if (pipeLineName == 'OpenShift-Promotions') {
            runActions.splice(3, 0, "Promotions")
            defaultForRun = "Promotions";
            handleRunActions(runActions, defaultForRun);
        } else if (pipeLineName === 'OpenShift-Bulk-Promotions') {
            runActions.splice(3, 0, "Bulk Promotions");
            defaultForRun = "Bulk Promotions";
            handleRunActions(runActions, defaultForRun);
        } else if (pipeLineName === 'OpenShift-List-Deployments') {
            runActions.splice(3, 0, "List Deployments");
            defaultForRun = "List Deployments";
            handleRunActions(runActions, defaultForRun);
        } else if (pipeLineName === 'bulk-tags') {
            await getBulkTags(config, config.bulkTags);
        } else {
            if (pipeLineName) {
                let repoName = _.get(pipeLineList, `[${repoIndex}].repo`, '');
                let repoBranches = _.get(config, `repoBranches[${repoName}]`, '');
                let branchesRawList = _.values(repoBranches);
                let branchData = await branchPick(repoBranches, branchesRawList);
                branchOption = branchData.option;
                branchName = branchData.name;

                ui.printCurrentJobInfo(repoName, branchName);
                fsUtil.saveCurrentJobRuns(config, pipeLineName, repoName, branchName, branchOption);
                
                if (branchOption === 'exit') {
                    console.log(chalk.red.bold('Exiting...'));
                    process.exit(0);
                }
                
                if (branchOption) handleRunActions();
            }
        }
    }
} catch (err) {
    console.error(err);
}