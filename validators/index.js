import _ from 'lodash';

const regexStrings = {
    equalTo: /[\=]{1}/,
    tag: /[A-F0-9]{6}/,
    deployment: /-v[0-9]/
};
const facades = [
    "brokerageportal",
    "brokerageworkbench",
    "carrierportal",
    "cczportal",
    "documentapp",
    "elevatedriver",
    "equipmentportal",
    "highlander",
    "hubconnectportal",
    "hubprosupport",
    "invoicingservice",
    "location",
    "messagingportal",
    "microservicesexternal",
    "omapp",
    "opsworkbench",
    "poolmanagement",
    "soa"
];

const environment = (environment) => {
    if (!_.includes(['dev', 'qa', 'ua'], environment)) return "Environment should be dev, qa, ua";
    return true;
}
const facade = (facade) => {
    if (!_.includes(facades, facade)) return "Facade should be valid";
    return true;
}
const tag = (tag) => {
    if (!regexStrings.tag.test(tag)) return "Tag should be upper case and alphanumeric (digits and A-F) and 6 characters long";
    return true;
}
const deployment = (deployment) => {
    if (deployment && !regexStrings.deployment.test(deployment)) return "Deployment should have version included ex: om-order-v1-0";
    return true;
}
const services = (services) => {
    let servicesList = services.split('\n');
    servicesList.pop(); // removing last empty line
    let errorList = [];
    _.forEach(servicesList, (service) => {
        if (!regexStrings.equalTo.test(service)) errorList.push(`Service doesnt have = in it for : ${service}`);
        const serviceName = service.split('=')[0];
        const tag = service.split('=')[1];
        if (!regexStrings.tag.test(tag)) errorList.push(`Tag should be upper case and alphanumeric (digits and A-F) and 6 characters long for : ${serviceName}, tag: ${tag}`);
    })
    if (errorList.length > 0) return errorList.join('\n');
    return true;
}

export {
    environment,
    tag,
    services,
    deployment,
    facade
}
