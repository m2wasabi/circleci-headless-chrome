import { launch, Page } from "puppeteer";
import { join } from "path";
import ConfigParser from "./ConfigParser";
import IE2ETest from "./IE2ETest";
import { execSync } from "child_process";
import { readFile, writeFile } from "fs";
import DiffMaker from "./DiffMaker";
const exportDir: string = process.env.CIRCLE_ARTIFACTS || "ss";
const nodeTotal: number = Number.parseInt(process.env.CIRCLE_NODE_TOTAL) || 1;
const nodeIndex: number = Number.parseInt(process.env.CIRCLE_NODE_INDEX) || 0;
const artifactoryURL = process.env.ARTIFACTORY_URL;

async function readJSON(path: string) {
    return new Promise((resolve, reject) => {
        readFile(path, "utf-8", (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(JSON.parse(data));
            }
        })
    });
}

async function writeJSON(path: string, content: any) {
    return new Promise((resolve, reject) => {
        writeFile(path, JSON.stringify(content, null, 2), (err) => {
            if (err) {
                reject(err)
            } else {
                resolve();
            }
        })
    });
}
async function test() {
    const browser = await launch({ headless: false });
    const page = await browser.newPage();
    const config = await ConfigParser.loadAll();
    const trigger: any = await readJSON("trigger.json");
    if (nodeIndex === 0) {
        await writeJSON(join(exportDir, "e2e.json"), { config, trigger });
    }
    const filteredConfig = config.filter((v, i) => (i % nodeTotal) === nodeIndex);
    let logs = [];
    page.on("console", (e) => {
        logs.push({
            type: e.type,
            text: e.text
        });
    });
    execSync(`mkdir -p ${exportDir}/current`)
    execSync(`mkdir -p ${exportDir}/meta`)
    for (let i = 0; i < filteredConfig.length; i++) {
        await captureWithPage(page, filteredConfig[i], logs, trigger.urlSuffix);
        logs.splice(0, logs.length);
    }
    await browser.close();
    sendToS3(trigger.sha);
    downloadPrevious(trigger.previousSHA);
    for (let i = 0; i < filteredConfig.length; i++) {
        const config = filteredConfig[i];
        diff(config.group + config.name, config)
    }
}

function sendToS3(sha: string) {
    console.log(execSync(`sh -x upload.sh ${sha}`).toString());
}

function downloadPrevious(previousSHA: string) {
    console.log(execSync(`sh -x download.sh ${previousSHA}`).toString());
}

async function diff(fileNameWithoutExt: string, config: IE2ETest) {
    try {
        let type = "pixel";
        let threshold = parseFloat(config.threshold);
        if (config.threshold.charAt(config.threshold.length - 1) === "%") {
            type = "percent";
            threshold = parseFloat(config.threshold) / 100;
        }
        console.log(execSync(`sh -x diff.sh ${fileNameWithoutExt + ".png"} ${config.shift} ${type} ${threshold}`).toString());
    } catch (e) {
        const data = await readJSON(join(exportDir, "meta", fileNameWithoutExt + ".json")) as any;
        data.diffTestResult = false;
        await writeJSON(join(exportDir, "meta", fileNameWithoutExt + ".json"), data);
    }
}

async function captureWithPage(page: Page, config: IE2ETest, logs: any[], suffix: string) {
    const url = config.url + suffix;
    try {
        let loadTime: number, initializingTime: number;
        await page.setViewport({ width: config.width, height: config.height });
        console.log(`[E2E TEST (${config.group} - ${config.name})] (${config.url})`);
        let beginTime = Date.now();
        await page.goto(url);
        loadTime = Date.now() - beginTime;
        console.log(`--> Loaded in ${loadTime}ms`);
        beginTime = Date.now();
        await page.waitFor("canvas.gr-resource-loaded-canvas", {
            timeout: config.timeout
        });
        console.log(`--> Grimoire.js got ready state to render in ${Date.now() - beginTime}ms`);
        if (config.waitFor !== null) {
            beginTime = Date.now();
            await page.waitFor(config.waitFor);
            initializingTime = Date.now() - beginTime;
            console.log(`--> Waiting for custom waiting criteria ${initializingTime}ms`);
        } else {
            await page.waitFor(200);
        }
        await page.screenshot({ path: join(exportDir, "current", config.group + config.name + ".png"), type: "png" });
        await writeJSON(join(exportDir, "meta", config.group + config.name + ".json"), {
            config,
            loadTime,
            initializingTime,
            logs,
            diffTestResult: true,
            url
        });
    } catch (e) {
        await writeJSON(join(exportDir, "meta", config.group + config.name + ".json"), {
            config,
            loadTime: "FAIL",
            initializingTime: "FAIL",
            logs,
            diffTestResult: false,
            url
        });
    }
}

test();