#!/usr/bin/env python3

import os
import sys
import json
from collections import OrderedDict
from itertools import islice
from termcolor import colored
import requests
from requests.auth import HTTPBasicAuth
from pick import pick
import urllib.parse
from datetime import datetime
import time
import re

# Variables
configFile = "jenkins.json"
config = ''
repoOption = ''
branchOption = ''
pipeLineName = ''
jobNumber = ''

def loadConfig(jsonFilePath):
    """Load config.json

    Parameters
    ----------
    jsonFilePath : str
        Config json file name
    
    Returns
    -------
    dict
        config json object
    """
    # Opening JSON file
    config = open(jsonFilePath)
    data = json.load(config, object_pairs_hook=OrderedDict)
    # Closing file
    config.close()
    return data

def updateConfig(config):
    ## Save our changes to JSON file
    jsonFile = open(configFile, "w+")
    jsonFile.write(json.dumps(config, indent=4))
    jsonFile.close()

def saveCurrentJobRuns(config, pipeLineName, repoName, branchName, branchOption):
    config["previousJobRun"]["pipeLineName"] = pipeLineName
    config["previousJobRun"]["branchName"] = branchName
    config["previousJobRun"]["branchOption"] = branchOption
    config["previousJobRun"]["repoName"] = repoName
    updateConfig(config)

def saveUserAuthToken(config, crumb):
    config["userInfo"]["crumb"] = crumb
    updateConfig(config)

def saveUserInfo(config, fullName, email):
    config["userInfo"]["userName"] = fullName
    config["userInfo"]["email"] = email
    updateConfig(config)

def getListItemByName(items, name):
    for tupleItem in items:
        tupleName = tupleItem[0]
        tupleValue = tupleItem[1]
        if tupleName == name:
            if type(tupleValue) == str:
                return tupleValue
            return tupleValue

def processRun(runItem):
    runInfo = {}
    # print(runItem)
    jobId = getListItemByName(runItem, 'id')
    commits = getRunChangeSets(config, pipeLineName, branchOption, jobId)
    # print(commits)
    name = getListItemByName(runItem, 'name')
    status = getListItemByName(runItem, 'status')
    stages = getListItemByName(runItem, 'stages')
    runInfo['name'] = name
    runInfo['status'] = status
    runInfo['commits'] = commits
    runInfo['stages'] = []
    # print(runInfo)
    
    for j in range(len(stages)):
        stageInfo = {}
        stage = stages[j]
        stageItem = stage.items()
        stageName = getListItemByName(stageItem, 'name')
        stageStatus = getListItemByName(stageItem, 'status')
        stageDuration = getListItemByName(stageItem, 'durationMillis')
        minutes, seconds = mil_convert(stageDuration)
        stageDurationHumanRedable = "{}m {}s".format(minutes, seconds)
        stageInfo['stageName'] = stageName
        stageInfo['stageStatus'] = stageStatus
        stageInfo['stageDuration'] = stageDurationHumanRedable
        runInfo['stages'].append(stageInfo)
    return runInfo

def getStatusColor(status):
    statusColor = 'green'
    if status == 'SUCCESS':
        statusColor = 'green'
    elif status == 'IN_PROGRESS':
        statusColor = 'yellow'
    elif status == 'FAILED':
        statusColor = 'red'
    elif status == 'ABORTED':
        statusColor = 'red'
    return colored(status, statusColor)

def getHeaderText(text):
    return colored(text, 'white', attrs=['bold'])

def getHeaders(headerName):
    headers = {
        "job": {
            "formatting": "{d[0]:<21} {d[1]:<25}",
            "items": ['Job', 'Status']
        },
        "stage": {
            "formatting": "{d[0]:<46} {d[1]:<23} {d[2]:>14}",
            "items": ['Name', 'Status', 'Duration']
        },
        "commit": {
            "formatting": "{d[0]:<38} {d[1]:<33} {d[2]:<60}",
            "items": ['Date', 'Author', 'Commit Message']
        }
    }
    appliedFormat = headers[headerName]['formatting']
    # print(appliedFormat)
    appliedItems = headers[headerName]['items']
    formattedItems = []
    for i in appliedItems:
        formattedItems.append(getHeaderText(i))
    # print(formattedItems)
    print(appliedFormat.format(d=formattedItems))

def printRun(runItem):
    name = runItem['name']
    status = runItem['status']
    stages = runItem['stages']
    commits = runItem['commits']
    jobItemFormat = "{:<8} {:<15}"
    stageItemFormat = "{:<33} {:<10} {:>8}"
    commitItemFormat = "{:<25} {:<20} {:<60}"
    # print(name, status)
    # print(type(stages))
    print('\n')
    print("{:=^70}".format(''))
    getHeaders('job')
    print (jobItemFormat.format(name, getStatusColor(status)))
    print("{:-^70}".format(''))
    getHeaders('commit')
    for commitIndex, commitValue in enumerate(commits):
        commitItem = commits[commitIndex]
        # print(commitItem)
        commitMsg = commitItem['msg']
        commitDate = int(commitItem['timestamp'])/1000
        dateObject = datetime.fromtimestamp(commitDate).strftime('%b %d %Y %I:%M:%S %p')
        # print(dateObject)
        commitAuthor = commitItem['author']
        print (commitItemFormat.format(dateObject, commitAuthor, commitMsg))

    print("{:-^60}".format(''))
    getHeaders('stage')
    for stageIndex, stageValue in enumerate(stages):
        stageItem = stages[stageIndex]
        # print(stageItem)
        stageName = stageItem['stageName']
        stageStatus = stageItem['stageStatus']
        stageDuration = stageItem['stageDuration']
        print (stageItemFormat.format(stageName, getStatusColor(stageStatus), stageDuration))

def mil_convert(milliseconds):
   seconds, milliseconds = divmod(milliseconds, 1000)
   minutes, seconds = divmod(seconds, 60)
   return minutes, seconds
    
def makeRequest(urlPath, httpMethod, config):
    userInfo = config['userInfo']
    url = userInfo['baseUrl'] + urlPath
    headers = {"Jenkins-Crumb": "{}".format(userInfo['crumb'])}
    # print(url)
    # print(headers)
    try:
        if httpMethod == 'get':
            response = requests.get(url, headers = headers, auth = (userInfo['objectId'], userInfo['appToken']))
        elif httpMethod == 'post':
            response = requests.post(url, headers = headers, auth = (userInfo['objectId'], userInfo['appToken']))
        
        if 'content-type' in response.headers:
            contentType = response.headers['content-type']
            if contentType == 'text/plain;charset=utf-8':
                return response.text
            elif contentType == 'application/json;charset=utf-8':
                return response.json()
        return response
    except:
        print("{}".format(colored("An error occurred while making web request", 'red'), 'red'))

def makeAuthRequest(urlPath, httpMethod, config):
    userInfo = config['userInfo']
    url = userInfo['baseUrl'] + urlPath
    # print(url)
    # print(headers)
    try:
        if httpMethod == 'get':
            response = requests.get(url, auth=HTTPBasicAuth(userInfo['objectId'], userInfo['appToken']))
        
        if 'content-type' in response.headers:
            contentType = response.headers['content-type']
            if contentType == 'text/plain;charset=utf-8':
                return response.text
            elif contentType == 'application/json;charset=utf-8':
                return response.json()
        return response
    except:
        print("{}".format(colored("An error occurred while making web request", 'red'), 'red'))

def processUserDetails(name, email):
    print("Logged in as")
    print("Name: {}".format(colored(name, 'green', attrs=['bold'])))
    print("Email: {}".format(colored(email, 'green', attrs=['bold'])))

def getUserAuthToken(config):
    tokenResponse = makeAuthRequest('crumbIssuer/api/json', 'get', config)
    return tokenResponse['crumb']

def printUserDetails(config):
    userDetails = makeRequest("me/api/json", "post", config)
    email = userDetails['property'][4]['address']
    fullName = userDetails['fullName']
    saveUserInfo(config, fullName, email)
    processUserDetails(fullName, email)

def getRepositoryNames(pipeLineList):
    repoListNames = []
    for pipeLineItem in pipeLineList:
        repo = pipeLineItem['repo']
        repoListNames.append(repo)
    return repoListNames

def getPipeLineInfo(pipeLineList, index, propertyName):
    return pipeLineList[index][propertyName]

def getPipeLineJobs(pipeLineName, config):
    pipeLineJobsUrl = "job/"+pipeLineName+"/api/json?tree=jobs[name]"
    pipeLineJobsResponse = makeRequest(pipeLineJobsUrl, "post", config)
    pipeLineJobs = pipeLineJobsResponse['jobs']
    pipeLineJobNames = {}
    for pipeLineJob in pipeLineJobs:
        # print(pipeLineJob, type(pipeLineJob))
        pipeLineJobName = pipeLineJob['name']
        urlSafeName = urllib.parse.unquote(pipeLineJobName)
        pipeLineJobNames[pipeLineJobName] = urlSafeName
    return pipeLineJobNames

def getJobRuns(config, pipeLineName, branchName):
    jobRunsUrl = "job/"+pipeLineName+"/job/"+branchName+"/wfapi/runs"
    jobRunsResponse = makeRequest(jobRunsUrl, "post", config)
    # print(jobRunsResponse)
    runsToConsider = 5
    runsInfo = []
    for i in islice(jobRunsResponse, 0, runsToConsider):
        runItem = i.items()
        processedRunItem = processRun(runItem)
        runsInfo.append(processedRunItem)
    
    # Print run information
    for idx, value in enumerate(runsInfo):
        runItem = value
        printRun(runItem)

def printJobErrors(errors):
    for error in enumerate(errors):
        error = error[1]
        print(colored(error, 'red'))

def getJobErrors(config, pipeLineName, branchName, jobNumber):
    jobConsoleTextUrl = "job/"+pipeLineName+"/job/"+branchName+"/"+jobNumber+"/consoleText"
    jobConsoleTextResponse = makeRequest(jobConsoleTextUrl, "post", config)
    errorsList = re.findall(r'(.*?ERROR:.*?|.*?java\.lang\.Exception:.*?|.*?ABORTED.*?|.*?script\sreturned\sexit\scode\s143.*?)\n', jobConsoleTextResponse)
    printJobErrors(errorsList)

def getJobConsoleText(config, pipeLineName, branchName, jobNumber):
    jobConsoleTextUrl = "job/"+pipeLineName+"/job/"+branchName+"/"+jobNumber+"/consoleText"
    jobConsoleTextResponse = makeRequest(jobConsoleTextUrl, "post", config)
    print(jobConsoleTextResponse)

def getRunChangeSets(config, pipeLineName, branchName, jobId):
    jobRunUrl = "job/"+pipeLineName+"/job/"+branchName+"/"+jobId+"/api/json"
    #?tree=changeSets[items[msg]]"
    commits = []
    try:
        jobRunResponse = makeRequest(jobRunUrl, "post", config)
        if len(jobRunResponse['changeSets']) > 0:
            changeSets = jobRunResponse['changeSets'][0]['items']
            for changeSet in changeSets:
                # print(changeSet)
                msg = changeSet['msg']
                author = changeSet['author']['fullName']
                timestamp = changeSet['timestamp']
                changeSetObject = {'msg': msg, 'author': author, 'timestamp': timestamp}
                # print(changeSetObject)
                commits.append(changeSetObject)
    except:
        print("{}: {}".format(colored("An error occurred while getting change sets for job", 'red'), colored(jobId, 'red')))
    
    return commits

def updateRepoBranches(pipeLineList, config):
    print('Updating all repo branches')
    excludeList = config['excludedPipeLines']
    repoBranches = {}
    for pipeLineItem in pipeLineList:
        name = pipeLineItem["name"]
        repo = pipeLineItem["repo"]
        exist_count = excludeList.count(name)
        if exist_count <= 0:
            pipeLineBranches = getPipeLineJobs(name, config)
            repoBranches[repo] = pipeLineBranches
    # print(repoBranches)
    config['repoBranches'] = repoBranches
    updateConfig(config)
    print("Updated all repos with branches")

def processRepoBranches(repoBranches):
    keys = repoBranches.keys()
    values = repoBranches.values()
    newKeys = []
    newValues = []
    processedData = {}
    for key in keys:
        newKeys.append(key)
    for value in values:
        newValues.append(value)
    newKeys.append('exit')
    newValues.append('Exit')
    processedData['keys'] = newKeys
    processedData['values'] = newValues
    return processedData

def printCurrentJobInfo(repoName, branchName):
    print("Selected repo: {}".format(colored(repoName, 'green', attrs=['bold'])))
    print("Selected branch: {}".format(colored(branchName, 'green', attrs=['bold'])))

def branchPick(branchesList, branchesRawList):
    branchData = dict()
    branchTitle = 'Please choose your branch: '
    branchOption, branchIndex = pick(branchesList, branchTitle, indicator='=>', default_index=0)
    branchData['name'] = branchOption
    branchOption = branchesRawList[branchesList.index(branchOption)]
    branchData['option'] = branchOption
    
    return branchData

def buildQueryParams(queryItems):
    query = ''
    for key in queryItems:
        query+= key + "=" + queryItems[key] + "&"
    # removing last & from the query string
    return query[:-1]

def serviceScale(config, pipeLineName, serviceScaleInputs):
    queryUrl = buildQueryParams(serviceScaleInputs)
    serviceScaleUrl = "job/"+pipeLineName+"/buildWithParameters?" + queryUrl
    # print(serviceScaleUrl)
    serviceScaleResponse = makeRequest(serviceScaleUrl, "post", config)
    if serviceScaleResponse.status_code == 201:
        print(colored("Service is scaled", 'green'))
    else:
        print(colored("Error in scaling", 'red'))

def promotions(config, pipeLineName, promotionsInputs):
    queryUrl = buildQueryParams(promotionsInputs)
    promotionsUrl = "job/"+pipeLineName+"/buildWithParameters?" + queryUrl
    # print(promotionsUrl)
    promotionsResponse = makeRequest(promotionsUrl, "post", config)
    # print(promotionsResponse)
    if promotionsResponse.status_code == 201:
        print(colored("Promoted", 'green'))
    else:
        print(colored("Error in promotion", 'red'))

def bulkPromotions(config, pipeLineName, bulkPromotionsInputs):
    queryUrl = buildQueryParams(bulkPromotionsInputs)
    promotionsUrl = "job/"+pipeLineName+"/buildWithParameters?" + queryUrl
    # print(promotionsUrl)
    promotionsResponse = makeRequest(promotionsUrl, "post", config)
    # print(promotionsResponse)
    if promotionsResponse.status_code == 201:
        print(colored("Bulk Promoted", 'green'))
    else:
        print(colored("Error in bulk promotion", 'red'))

def checkTag(str):
    # using regular expression to check if a string contains
    # at least one letter and one number
    match = re.search(r'[a-zA-Z]+', str) and re.search(r'[0-9]+', str)
    if match:
        return True
    else:
        return False
    
def takeScaleInputs():
    try:
        serviceScaleInputs = {'ENVIRONMENT': '', 'REPLICA': '', 'MICROSERVICES': ''}
        serviceScaleInputs['ENVIRONMENT'] = input("Input Environment (dev,qa,ua): ")
        environments = ['dev', 'qa', 'ua']
        replicaRange = range(0, 21)
        if serviceScaleInputs['ENVIRONMENT'] not in environments:
            raise ValueError("Environment should be either dev,qa,ua")
        serviceScaleInputs['REPLICA'] = input("Input Replicas (0-20): ")
        if int(serviceScaleInputs['REPLICA']) not in replicaRange:
            raise ValueError("Replica number is not in range of 0 - 20")
        serviceScaleInputs['MICROSERVICES'] = input("Input microservices separated by comma (om-order-v1-0,om-order-create-v1-0): ")
        return serviceScaleInputs
    except Exception as e:
        print(e)

def takePromotionsInputs():
    try:
        promotionsInputs = {'ENVIRONMENT': '', 'IMAGE_TAG': '', 'REPO_NAME': ''}
        promotionsInputs['ENVIRONMENT'] = input("Input Environment (dev,qa,ua): ")
        environments = ['dev', 'qa', 'ua']
        if promotionsInputs['ENVIRONMENT'] not in environments:
            raise ValueError("Environment should be either dev,qa,ua")
        promotionsInputs['IMAGE_TAG'] = input("Input tag (Ex. 31E7E3): ")
        if len(promotionsInputs['IMAGE_TAG']) != 6:
            raise ValueError("Tag should be of length 6 characters")
        elif checkTag(promotionsInputs['IMAGE_TAG']) == False:
            raise ValueError("Tag should be alphanumeric")
        elif promotionsInputs['IMAGE_TAG'].isupper() == False:
            raise ValueError("Tag should be uppercase")
        promotionsInputs['REPO_NAME'] = input("Input repo (Ex. om-order): ")
        return promotionsInputs
    except Exception as e:
        print(e)

def takeBulkPromotionsInputs():
    try:
        promotionsInputs = {'DEST_ENV': '', 'SERVICES': ''}
        promotionsInputs['DEST_ENV'] = input("Input Environment (DEV,QA,UA): ")
        environments = ['DEV', 'QA', 'UA']
        if promotionsInputs['DEST_ENV'] not in environments:
            raise ValueError("Environment should be either DEV,QA,UA")
        print("Input services (Ex. om-order=67EC11) (Once pasted ENTER -> CTRL+D to exit from input prompt): ")
        services = []
        while True:
            try:
                line = input("")
            except EOFError:
                break
            services.append(line)
        servicesString = ''
        for key in services:
            servicesString+= key + "\n"
        promotionsInputs['SERVICES'] = servicesString
        return promotionsInputs
    except Exception as e:
        print(e)

def handleRunActions(runActions = ['Get Runs', 'Get Errors', 'Get Console Text', 'Exit']):
    runTitle = 'Please choose your actions:'
    runOption, runIndex = pick(runActions, runTitle, indicator='=>', default_index=0)

    if runOption == 'Get Runs':
        getJobRuns(config, pipeLineName, branchOption)
    
    elif runOption == 'Get Errors':
        print("Input Job Number:")
        jobNumber = str(input())
        getJobErrors(config, pipeLineName, branchOption, jobNumber)
    
    elif runOption == 'Get Console Text':
        print("Input Job Number:")
        jobNumber = str(input())
        getJobConsoleText(config, pipeLineName, branchOption, jobNumber)
    
    elif runOption == 'Promotions':
        promotionsInputs = takePromotionsInputs()
        promotions(config, pipeLineName, promotionsInputs)
    
    elif runOption == 'Bulk Promotions':
        bulkPromotionsInputs = takeBulkPromotionsInputs()
        print("Sending request to Bulk Promotions")
        bulkPromotions(config, pipeLineName, bulkPromotionsInputs)

    elif runOption == 'Exit':
        print("Exiting...")
        return

def checkUserInfo(config):
    if not config['userInfo']['userName'] and not config['userInfo']['appToken']:
        print("{}".format(colored('User information is not available, please provide it in jenkins.json', 'red', attrs=['bold'])))
        print("{}".format(colored('Exiting...', 'red', attrs=['bold'])))
        sys.exit()
    
    if not config['userInfo']['crumb']:
        print("{}".format(colored('User is currently not logged in', 'red', attrs=['bold'])))
        print("{}".format(colored('Logging in...', 'green', attrs=['bold'])))
        crumb = getUserAuthToken(config)
        saveUserAuthToken(config, crumb)

        if not crumb or crumb == None:
            print("{}".format(colored('No auth token available', 'red', attrs=['bold'])))
            print("{}".format(colored('Exiting...', 'red', attrs=['bold'])))
            sys.exit()
        else:
            # Getting user information
            printUserDetails(config)
    else:
        print("Already logged in as")
        print("Name: {}".format(colored(config['userInfo']['userName'], 'green', attrs=['bold'])))
        print("Email: {}".format(colored(config['userInfo']['email'], 'green', attrs=['bold'])))
        time.sleep(1)

def main():
    """Starting point of script

    Parameters
    ----------
    None

    Returns
    -------
    None
    """

    global config
    global repoOption
    global branchOption
    global pipeLineName
    global configFile

    # Getting script directory to get config file when script gets loaded from other directories
    script_directory = os.path.dirname(os.path.abspath(sys.argv[0]))
    # print(script_directory)
    configFile = os.path.join(script_directory, configFile)

    config = loadConfig(configFile)

    # Check if config file has enough user information
    checkUserInfo(config)


    pipeLineList = config['pipeLineList']
    repoListNames = getRepositoryNames(pipeLineList)
    
    repoTitle = 'Please choose your repo: '
    repoOption, repoIndex = pick(repoListNames, repoTitle, indicator='=>', default_index=0)

    # print(repoOption)
    # print(repoIndex)
    if repoOption == 'Exit':
        print("{}".format(colored('Exiting...', 'red', attrs=['bold'])))
        sys.exit()
    if repoOption == 'Update repo branches':
        updateRepoBranches(pipeLineList, config)
    elif repoOption == 'Run Previous Job':
        pipeLineName = config["previousJobRun"]["pipeLineName"]
        repoName = config["previousJobRun"]["repoName"]
        branchName = config["previousJobRun"]["branchName"]
        branchOption = config["previousJobRun"]["branchOption"]
        if pipeLineName and branchOption:
            printCurrentJobInfo(repoName, branchName)
            getJobRuns(config, pipeLineName, branchOption)
        else:
            print("{}".format(colored("Previous job information not available", 'red', attrs=['bold'])))

    else:
        pipeLineName = getPipeLineInfo(pipeLineList, repoIndex, 'name')
        
        if pipeLineName == 'OpenShift-Promotions':
            runActions = ['Get Runs', 'Get Errors', 'Get Console Text', 'Promotions', 'Exit']
            handleRunActions(runActions)
        elif pipeLineName == 'OpenShift-Bulk-Promotions':
            runActions = ['Get Runs', 'Get Errors', 'Get Console Text', 'Bulk Promotions', 'Exit']
            handleRunActions(runActions)
        else:
            if pipeLineName:
                repoName = getPipeLineInfo(pipeLineList, repoIndex, 'repo')
                repoBranches = config['repoBranches'][repoName]
                # print(repoBranches)
                processedRepoBranches = processRepoBranches(repoBranches)
                # print(processedRepoBranches)
                branchesRawList = processedRepoBranches['keys']
                branchesList = processedRepoBranches['values']
                branchData = branchPick(branchesList, branchesRawList)
                branchOption = branchData['option']
                branchName = branchData['name']

                printCurrentJobInfo(repoName, branchName)
                saveCurrentJobRuns(config, pipeLineName, repoName, branchName, branchOption)
                
                if branchOption == 'exit':
                    print("{}".format(colored('Exiting...', 'red', attrs=['bold'])))
                    sys.exit()
                
                handleRunActions()

if __name__ == '__main__':
    main()
