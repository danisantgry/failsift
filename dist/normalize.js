import stripAnsi from "strip-ansi";
const timestampPrefix = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\s+/u;
export function normalize(input) {
    return input.split(/\r?\n/u).map((raw, index) => {
        const withoutTimestamp = raw.replace(timestampPrefix, "");
        const isGithubScriptSource = /^\u001b\[36;1m.*\u001b\[0m$/u.test(withoutTimestamp);
        const isGithubGroupMarker = /^##\[(?:group|endgroup)\]/iu.test(withoutTimestamp);
        return {
            number: index + 1,
            text: isGithubScriptSource || isGithubGroupMarker
                ? ""
                : stripAnsi(withoutTimestamp)
                    .replace(/^##\[(error|warning|notice)\]/iu, "[$1] ")
                    .trimEnd()
        };
    });
}
