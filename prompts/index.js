import inquirer from "inquirer";
import * as validators from "../validators/index.js";

async function takePromotionsInputs() {
    try {
        const promotionsAnswer = await inquirer.prompt([
            { type: 'input', name: 'ENVIRONMENT', message: 'Input Environment (dev, qa, ua): ',
                validate: (ENVIRONMENT) => validators.environment(ENVIRONMENT)
            },
            { type: 'input', name: 'REPO_NAME', message: 'Repo Name: ' },
            { type: 'input', name: 'IMAGE_TAG', message: 'Image Tag:',
                validate: (IMAGE_TAG) => validators.tag(IMAGE_TAG)
            }
        ]);
        promotionsAnswer.NAMESPACE = "production";
        promotionsAnswer.GITHUB_ORGANIZATION = "HUBG-NodeJS";
        return promotionsAnswer
    } catch (error) {
        console.log(chalk.red(error));
    }
}

async function takeBulkPromotionsInputs() {
    try {
        const bulkPromotionsAnswer = await inquirer.prompt([
            { type: 'input', name: 'ENVIRONMENT', message: 'Input Environment (dev, qa, ua): ',
                validate: (ENVIRONMENT) => validators.environment(ENVIRONMENT)
            },
            { type: 'editor', name: 'SERVICES', message: 'Input Services: (Ex. om-order=67EC11)',
                validate: (SERVICES) => validators.services(SERVICES)
            },
        ]);
        bulkPromotionsAnswer.NAMESPACE = "production";
        bulkPromotionsAnswer.GITHUB_ORGANIZATION = "HUBG-NodeJS";
        return bulkPromotionsAnswer
    } catch (error) {
        console.log(chalk.red.bold(error));
    }
}

async function takeListDeploymentsInputs() {
    const listDeploymentsAnswer = await inquirer.prompt([
        { type: 'input', name: 'ENVIRONMENT', message: 'Input Environment (dev, qa, ua, prod): ' },
        // { type: 'input', name: 'namespace', message: 'Input Namespace: ' },
        // { type: 'input', name: 'columns', message: 'Input Columns:' },
        { type: 'input', name: 'DEPLOYMENTS', message: 'Input Deployments (om-order-v1-0):',
            validate: (DEPLOYMENTS) => validators.deployment(DEPLOYMENTS)
        }
    ]);
    return listDeploymentsAnswer;
}

export {
    takePromotionsInputs as promotions,
    takeBulkPromotionsInputs as bulkPromotions,
    takeListDeploymentsInputs as listDeployments
}