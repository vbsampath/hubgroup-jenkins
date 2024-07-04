# Hubgroup Jenkins Integration

## Introduction

This tool allows users to get jenkins information from deployments.hubgroup.com from CLI.  
This is targeted around decreasing repetitive tasks we do in jenkins

## Installation

```bash
npm install
```

## Hubgroup Setup

* Goto [Jenkins](https://deployments.hubgroup.com) website
* Login to Jenkins using Hubgroup email and password
* Goto your username in top right corner and open **Configure**
* Save **Object ID** from Description
* Goto **API Token** section and click on **Add new Token**
* Give it a proper name and click on **Generate**
* Save the token which was generated. This is app password so keep it safe
* Goto project folder and open jenkins.json file
* Goto top section and find **userInfo** and put **Object ID** into **objectId** and newly generated token to **appToken**
* **userName, email and crumb** will be updated once login happens

## Project Setup

Goto project folder and make index.js as executable  

```bash
chmod +x ./index.js
```

Its highly suggested to make this executable available from any folder. In order to make it accessible add an alias in your shell profile  

Open shell configuration

```bash
nano ~/.zshrc
```

Add alias to the file and save it

```bash
alias jenkins="node <path_to_project>/index.js"
```

Note:  

* Replace path_to_project with your own path
* Check if node is available and accessible from everywhere, tested on 20.11.1

Update aliases in your shell profile

```bash
source ~/.zshrc
```

Check if new alias is working

```bash
alias jenkins
```

If we see the entry and path then its setup properly

Setting up aliases in your shell profile is not in scope of this tool but this might help [Setup Aliases in shell](https://presscargo.io/articles/how-to-add-an-alias-in-macos-with-terminal/)

## Usage

* Type in **jenkins** and we see a list of repositories available
* Select any of the repositories (moving with up and down arrow) or can search if we know what repository we want
* Now we get **branches** for the repositories which are having pipelines in jenkins
* Select branch for the repository
* Now we get **actions** like **Get Runs, Get Errors, Get Console Text, Exit**
* Select **Get Runs** to get the jobs for that branch and repository

### Get Runs

This selection gives you plethora of information about the last 5 (configurable in code) jobs run for that branch and repository  

This gives information about job number and status, commits details like who commited when and with what message, stages information as well. This is what we want to get and especially tag

### Get Errors

This selection gives you error information about the job  
Takes in a job number and gives you all possible errors why a job failed  
This will help to debug why a job failed and make necessary changes  

### Get Console Text

This selection gives raw console text printed for the job  
This will be useful if we want to get all the information to understand how things are running and may help to debug unique cases

### Exit

This selection exits from the application whereever its found

### Promotions

This selection is responsible for OpenShift Promotions  

Inputs:

* Environment (Ex: qa)
* Repo Name (Ex: om-order)
* Image Tag (Ex: 112E3F)

Note: Make sure we are typing in correct repo name and tag otherwise promotion will fail

### Bulk Promotions

This selection is responsible for OpenShift Bulk Promotions  
For Services your default editor will be opened to input the details, paste it and save it and then close it  
My environment has **VI** editor and your mileage may vary

Inputs:

* Environment (Ex: qa)
* Services (Ex: om-order=112E3F)

Note: Make sure we are typing in correct repo name and tag otherwise promotion will fail. Format should be of \<reponame\>=\<tag\> and put in multiple lines if multiple services are there

### List Deployments

This selection is responsible for listing deployment information in different environments  
This gives information like repository name and tag in a environment  
Very useful for checking tags en-masse

Inputs:

* Environment (Ex: qa)
* Deployments (Ex: om-order-v1-0)

Note: Make sure the deployment has version information typed in properly. If we dont enter any deployment then we get all the micro services

### Tags Of Multiple Micro-Services (WIP)

This selection gives info of selected micro services for selected branches  
It givves information about **Pre Develop** and **Develop** branches, its latest tags and the job number  
Very useful to check tags in **Pre Develop** and **Develop** for all micro services  
If we are interested in more micro-services then need to add relevant information in jenkins.json for **bulkTags** property  
Current limitation is that its heavily targeted around develop and pre-development branches and need to add same branches in all branches

### Run Previous Job

This selection is responsible for running previous job  
When a job is started it will take time to complete
We can check the runs and we might see the status will be IN_PROGRESS
If we want to check the status frequently then we can use this selection instead of selecting repo and branch everytime  
When a job is run the repo and branch information is stored in jenkins.json for faster retrieval next time

### Update Repo Branches

This selection updates repository branches in jenkins.json  
This is useful if we see that branches are not listed but are available on git.

## Add New Pipeline

* When a new pipeline is created then we can add the same to **pipeLineList** property

## TODO

* Improve code quality
* Integration with GitHub API
