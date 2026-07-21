const DEMO_LINE_COUNT = 8_247;

export function createDemoLog(): string {
  const failure = [
    "Run cargo check --all-targets",
    "    Checking order-core v0.2.0 (/home/runner/work/example/order-core)",
    "api_key=demo-value-not-a-secret",
    "CI owner: ci-owner@example.invalid",
    "warning: unused import: `std::env`",
    "error[E0308]: mismatched types",
    "  --> src/config.rs:18:9",
    "   |",
    "18 |         endpoint,",
    "   |         ^^^^^^^^ expected `Url`, found `String`",
    "error: could not compile `order-core` (lib) due to 1 previous error",
    "Error: Process completed with exit code 101."
  ];
  const progress = Array.from(
    { length: DEMO_LINE_COUNT - failure.length },
    (_, index) => `build progress ${index + 1}: dependency cache ready`
  );
  return [...progress, ...failure].join("\n");
}
