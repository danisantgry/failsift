function candidate(line, values) {
    return { ...values, lineNumber: line.number };
}
export const typescriptParser = {
    id: "typescript",
    parse(lines) {
        const results = [];
        const patterns = [
            /^(.*?\.(?:ts|tsx|js|jsx))\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)$/iu,
            /^(.*?\.(?:ts|tsx|js|jsx)):(\d+):(\d+)\s+-\s+error\s+(TS\d+):\s*(.+)$/iu
        ];
        for (const line of lines) {
            for (const pattern of patterns) {
                const match = pattern.exec(line.text.trim());
                if (!match)
                    continue;
                results.push(candidate(line, {
                    parser: "typescript",
                    framework: "TypeScript",
                    category: "compile",
                    message: `${match[4]}: ${match[5]}`,
                    file: match[1],
                    sourceLine: Number(match[2]),
                    column: Number(match[3]),
                    score: 100,
                    suggestion: "Run the TypeScript compiler locally with the repository's build or type-check command."
                }));
                break;
            }
        }
        return results;
    }
};
export const eslintParser = {
    id: "eslint",
    parse(lines) {
        const results = [];
        let currentFile;
        for (const line of lines) {
            const trimmed = line.text.trim();
            if (/^(?:[A-Za-z]:\\|\/|\.\/).+\.[cm]?[jt]sx?$/u.test(trimmed)) {
                currentFile = trimmed;
                continue;
            }
            const match = /^(\d+):(\d+)\s+error\s+(.+?)(?:\s{2,}([@\w/-]+))?$/iu.exec(trimmed);
            if (!match)
                continue;
            const rule = match[4] ? ` (${match[4]})` : "";
            results.push(candidate(line, {
                parser: "eslint",
                framework: "ESLint",
                category: "lint",
                message: `${match[3]}${rule}`,
                ...(currentFile ? { file: currentFile } : {}),
                sourceLine: Number(match[1]),
                column: Number(match[2]),
                score: 94,
                suggestion: "Run the repository's lint command locally and inspect the reported rule."
            }));
        }
        return results;
    }
};
export const testParser = {
    id: "javascript-tests",
    parse(lines) {
        const results = [];
        let failedFile;
        for (const line of lines) {
            const trimmed = line.text.trim();
            const fileMatch = /^(?:FAIL|\u276f|>)\s+(.+?\.(?:test|spec)\.[cm]?[jt]sx?)/u.exec(trimmed);
            if (fileMatch)
                failedFile = fileMatch[1];
            const assertion = /^(?:AssertionError|Error):\s*(.+)$/u.exec(trimmed);
            if (assertion) {
                const context = lines
                    .slice(Math.max(0, line.number - 12), line.number + 2)
                    .map((item) => item.text)
                    .join(" ");
                const isVitest = /vitest|\bRUN\s+v\d+/iu.test(context);
                const isTestOutput = isVitest || /\bjest\b|\bFAIL\s+.+\.(?:test|spec)\./iu.test(context);
                if (!failedFile && !isTestOutput)
                    continue;
                results.push(candidate(line, {
                    parser: "javascript-tests",
                    framework: isVitest ? "Vitest" : "Jest",
                    category: "test",
                    message: assertion[1],
                    ...(failedFile ? { file: failedFile } : {}),
                    score: 91,
                    suggestion: "Run the failing test file locally in isolation, then compare the expected and received values."
                }));
            }
        }
        return results;
    }
};
export const packageManagerParser = {
    id: "package-manager",
    parse(lines) {
        const results = [];
        for (const line of lines) {
            const trimmed = line.text.trim();
            const dependency = /(?:npm\s+error\s+code\s+|npm\s+ERR!\s+code\s+)?(ERESOLVE|EAI_AGAIN|ECONNREFUSED|ERR_PNPM_[A-Z_]+)\b[:\s-]*(.*)$/iu.exec(trimmed);
            if (dependency) {
                results.push(candidate(line, {
                    parser: "package-manager",
                    framework: /pnpm/iu.test(trimmed) ? "pnpm" : /yarn|YN\d+/u.test(trimmed) ? "Yarn" : "npm",
                    category: "dependency",
                    message: `${dependency[1]}${dependency[2] ? `: ${dependency[2].trim()}` : ""}`,
                    score: 88,
                    suggestion: "Re-run dependency installation locally with the same lockfile and runtime version."
                }));
            }
            const command = /^(?:(?:npm\s+(?:ERR!|error).*)|(?:pnpm|yarn).*)\b(?:command failed|lifecycle script .*failed)\b/iu.exec(trimmed);
            if (command) {
                results.push(candidate(line, {
                    parser: "package-manager",
                    framework: /pnpm/iu.test(trimmed) ? "pnpm" : /yarn/iu.test(trimmed) ? "Yarn" : "npm",
                    category: "command",
                    message: trimmed,
                    score: 42,
                    cascade: true,
                    suggestion: "Inspect the earlier error from the command that failed."
                }));
            }
        }
        return results;
    }
};
export const pytestParser = {
    id: "pytest",
    parse(lines) {
        const results = [];
        for (const line of lines) {
            const failed = /^FAILED\s+(.+?)(?:::([^\s]+))?\s+-\s+(.+)$/u.exec(line.text.trim());
            if (failed) {
                results.push(candidate(line, {
                    parser: "pytest",
                    framework: "pytest",
                    category: "test",
                    message: failed[3],
                    file: failed[1],
                    score: 96,
                    suggestion: `Run pytest for ${failed[1]}${failed[2] ? `::${failed[2]}` : ""} with verbose output.`
                }));
                continue;
            }
            const exception = /^E\s+([A-Za-z_][\w.]*?(?:Error|Exception)):\s*(.+)$/u.exec(line.text);
            if (exception) {
                results.push(candidate(line, {
                    parser: "pytest",
                    framework: "pytest",
                    category: "test",
                    message: `${exception[1]}: ${exception[2]}`,
                    score: 90,
                    suggestion: "Run the failing pytest case with -vv and inspect the first exception."
                }));
            }
        }
        return results;
    }
};
export const goParser = {
    id: "go",
    parse(lines) {
        const results = [];
        let failedTest;
        for (const line of lines) {
            const trimmed = line.text.trim();
            const test = /^--- FAIL:\s+(\S+)(?:\s+\([^)]+\))?$/u.exec(trimmed);
            if (test) {
                failedTest = test[1];
                results.push(candidate(line, {
                    parser: "go",
                    framework: "Go test",
                    category: "test",
                    message: `${failedTest} failed`,
                    score: 76,
                    suggestion: `Run go test -run '^${failedTest}$' ./... -v to reproduce the failing test.`
                }));
                continue;
            }
            const located = /^(?:\.\/)?([^\s:]+\.go):(\d+)(?::(\d+))?:\s*(.+)$/u.exec(trimmed);
            if (located) {
                const nearbyTest = lines
                    .slice(Math.max(0, line.number - 8), line.number + 8)
                    .map((item) => item.text)
                    .join("\n");
                const inFailedTest = failedTest !== undefined
                    || located[1].endsWith("_test.go")
                    || /--- FAIL:\s+\S+/u.test(nearbyTest);
                results.push(candidate(line, {
                    parser: "go",
                    framework: inFailedTest ? "Go test" : "Go",
                    category: inFailedTest ? "test" : "compile",
                    message: located[4],
                    file: located[1],
                    sourceLine: Number(located[2]),
                    ...(located[3] ? { column: Number(located[3]) } : {}),
                    score: inFailedTest ? 99 : 101,
                    suggestion: inFailedTest
                        ? `Run go test${failedTest ? ` -run '^${failedTest}$'` : ""} ./... -v to reproduce the failing test.`
                        : "Run go build ./... locally with the same Go version used in CI."
                }));
                continue;
            }
            const dependency = /^go:\s+(.+?)(?:\s*:\s*|\s+)(invalid version|unknown revision|reading .+?:\s*\d{3}.+)$/iu.exec(trimmed);
            if (dependency) {
                results.push(candidate(line, {
                    parser: "go",
                    framework: "Go modules",
                    category: "dependency",
                    message: `${dependency[1]}: ${dependency[2]}`,
                    score: 95,
                    suggestion: "Run go mod download and go mod verify using the same proxy settings as CI."
                }));
                continue;
            }
            const panic = /^panic:\s+(.+)$/u.exec(trimmed);
            if (panic) {
                results.push(candidate(line, {
                    parser: "go",
                    framework: "Go",
                    category: "runtime",
                    message: `panic: ${panic[1]}`,
                    score: 92,
                    suggestion: "Re-run the failing Go test with -v and inspect the first application frame in the stack trace."
                }));
            }
        }
        return results;
    }
};
export const rustParser = {
    id: "rust",
    parse(lines) {
        const results = [];
        for (let index = 0; index < lines.length; index += 1) {
            const line = lines[index];
            const trimmed = line.text.trim();
            const compiler = /^error(?:\[(E\d{4})\])?:\s*(.+)$/u.exec(trimmed);
            if (compiler) {
                const location = lines
                    .slice(index + 1, index + 7)
                    .map((item) => /^-->\s+(.+?):(\d+):(\d+)$/u.exec(item.text.trim()))
                    .find((match) => match !== null);
                const isCascade = /^could not compile\b|^aborting due to\b/iu.test(compiler[2]);
                const isDependency = /^failed to select a version for|^no matching package named/iu.test(compiler[2]);
                results.push(candidate(line, {
                    parser: "rust",
                    framework: isDependency ? "Cargo" : "Rust",
                    category: isDependency ? "dependency" : "compile",
                    message: `${compiler[1] ? `${compiler[1]}: ` : ""}${compiler[2]}`,
                    ...(location ? {
                        file: location[1],
                        sourceLine: Number(location[2]),
                        column: Number(location[3])
                    } : {}),
                    score: isCascade ? 43 : isDependency ? 97 : 102,
                    ...(isCascade ? { cascade: true } : {}),
                    suggestion: isDependency
                        ? "Run cargo update -v or cargo tree to inspect the conflicting dependency requirements."
                        : isCascade
                            ? "Inspect the first Rust compiler error earlier in the log."
                            : "Run cargo check --all-targets locally with the same Rust toolchain used in CI."
                }));
                continue;
            }
            const panic = /^thread '([^']+)' panicked at (.+?):(\d+):(\d+):?$/u.exec(trimmed);
            if (panic) {
                const detail = lines[index + 1]?.text.trim();
                results.push(candidate(line, {
                    parser: "rust",
                    framework: "Cargo test",
                    category: "test",
                    message: `${panic[1]} panicked${detail ? `: ${detail}` : ""}`,
                    file: panic[2],
                    sourceLine: Number(panic[3]),
                    column: Number(panic[4]),
                    score: 100,
                    suggestion: `Run cargo test ${panic[1]} -- --exact --nocapture to reproduce the panic.`
                }));
            }
        }
        return results;
    }
};
export const genericParser = {
    id: "generic",
    parse(lines) {
        const results = [];
        for (const line of lines) {
            const trimmed = line.text.trim();
            if (/^(?:\[error\]\s*)?(?:error:\s*)?(?:process completed with exit code|command (?:exited|failed) with exit code)/iu.test(trimmed)) {
                results.push(candidate(line, {
                    parser: "generic",
                    framework: "Generic",
                    category: "process",
                    message: trimmed,
                    score: 25,
                    cascade: true,
                    suggestion: "Inspect the first specific error before the process exit message."
                }));
                continue;
            }
            if (/^error:\s+(?:could not compile|test failed, to rerun pass)/iu.test(trimmed))
                continue;
            const explicit = /^(?:\[error\]\s*)?(fatal(?: error)?|error):\s*(.+)$/iu.exec(trimmed);
            if (explicit) {
                results.push(candidate(line, {
                    parser: "generic",
                    framework: "Generic",
                    category: "runtime",
                    message: `${explicit[1]}: ${explicit[2]}`,
                    score: 65,
                    suggestion: "Inspect the surrounding log lines and reproduce the failing command locally."
                }));
                continue;
            }
            if (/timed out|^killed$/iu.test(trimmed)) {
                results.push(candidate(line, {
                    parser: "generic",
                    framework: "Generic",
                    category: /timed out/iu.test(trimmed) ? "timeout" : "process",
                    message: trimmed,
                    score: /timed out/iu.test(trimmed) ? 55 : 25,
                    cascade: !/timed out/iu.test(trimmed),
                    suggestion: /timed out/iu.test(trimmed)
                        ? "Check for stalled network calls, deadlocks, or a timeout that is too low."
                        : "Inspect the first specific error before the process exit message."
                }));
            }
        }
        return results;
    }
};
export const builtInParsers = [
    typescriptParser,
    eslintParser,
    testParser,
    packageManagerParser,
    pytestParser,
    goParser,
    rustParser,
    genericParser
];
