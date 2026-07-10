import * as core from "@actions/core";
import { executeAction } from "./action-main.js";
void executeAction({
    getInput(name, required = false) {
        return core.getInput(name, { required });
    },
    getBooleanInput(name) {
        return core.getBooleanInput(name);
    },
    setOutput(name, value) {
        core.setOutput(name, value);
    },
    setFailed(message) {
        core.setFailed(message);
    },
    notice(message) {
        core.notice(message);
    },
    async writeSummary(markdown) {
        await core.summary.addRaw(markdown).write();
    }
});
