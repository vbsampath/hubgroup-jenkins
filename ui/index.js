import chalk from 'chalk';
import { Table } from "console-table-printer";
import moment from "moment";

/**
 * Prints user information
 * @param {string} name name of the user
 * @param {string} email email of the user
 */
function processUserDetails(name, email) {
    console.log(chalk.green.bold(`Name: ${name}`));
    console.log(chalk.green.bold(`Email: ${email}`));
}

function getStatusColor(status) {
    const statusColorMapping = {
        'SUCCESS': 'green',
        'IN_PROGRESS': 'yellow',
        'FAILED': 'red',
        'ABORTED': 'red'
    };
    return chalk[(status) ? statusColorMapping[status] : 'green'].bold(status);
}

function printRun(runItem) {
    let name = runItem.name;
    let status = runItem.status;
    let stages = runItem.stages;
    let commits = runItem.commits;
    // console.log(name, status);
    // console.log(type(stages));
    console.log("=".repeat(100));
    console.log('\n');
    const jobTable = new Table();
    jobTable.addRow({ Job: name, Status: getStatusColor(status) });
    jobTable.printTable();
    const commitTable = new Table({
        columns: [
            { name: "Date", alignment: "left" },
            { name: "Author", alignment: "left" },
            { name: "Commit Message", alignment: "left" },
        ]
    });
    for (let commitItem of commits) {
        let commitMsg = commitItem.msg;
        let dateObject = moment(commitItem.timestamp).format('MMM DD YYYY, h:mm:ss a');
        let commitAuthor = commitItem.author;
        commitTable.addRow({ Date: dateObject, Author: commitAuthor, "Commit Message": commitMsg });
    }
    commitTable.printTable();
    
    const stagesTable = new Table({
        columns: [
            { name: "Name", alignment: "left" },
            { name: "Status", alignment: "left" },
            { name: "Duration", alignment: "left" },
        ]
    });
    for (let stageItem of stages) {
        // console.log(stageItem);
        let stageName = stageItem.stageName;
        let stageStatus = stageItem.stageStatus;
        let stageDuration = stageItem.stageDuration;
        stagesTable.addRow({ Name: stageName, Status: getStatusColor(stageStatus), Duration: stageDuration });
    }
    stagesTable.printTable();
}

function printCurrentJobInfo(repoName, branchName) {
    console.log(chalk.green.bold(`Selected repo: ${repoName}`));
    console.log(chalk.green.bold(`Selected branch: ${branchName}`));
}

export {
    processUserDetails,
    printRun,
    printCurrentJobInfo
}