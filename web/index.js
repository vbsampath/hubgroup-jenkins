import axios from 'axios';
import _ from 'lodash';
import chalk from 'chalk';

async function makeRequest(urlPath, httpMethod, config, authRequest) {
    let userInfo = config.userInfo;
    let url = userInfo.baseUrl + urlPath;
    let headers = {"Jenkins-Crumb": `${userInfo.crumb}`};
    let auth = {username: userInfo.objectId, password: userInfo.appToken};
    let axiosConfig = {
        auth: auth,
    };
    (!authRequest) ? axiosConfig.headers = headers: {};
    // console.log(url);
    // console.log(headers)
    // console.log(auth)
    let response = '';
    try {
        if (httpMethod === 'GET') {
            response = await axios.get(url, axiosConfig);
        } else if (httpMethod === 'POST') {
            response = await axios.post(url, {}, axiosConfig);
        }
        
        if (_.includes(_.keys(response.headers), 'content-type')) {
            let contentType = _.get(response, 'headers[content-type]', '');
            if (contentType === 'text/plain;charset=utf-8') {
                return response.data;
            } else if (contentType === 'application/json;charset=utf-8') {
                return response.data;
            }
        }
    } catch (error) {
        console.log(chalk.red.bold(error.message));
        console.log(chalk.red.bold(`An error occurred while making web request`));
    }
    return response;
}

export {
    makeRequest
}