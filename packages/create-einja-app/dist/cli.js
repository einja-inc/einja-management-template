#!/usr/bin/env node

// src/cli.ts
import { Command } from "commander";
import { readFileSync as readFileSync5 } from "fs";
import { fileURLToPath as fileURLToPath3 } from "url";
import { dirname as dirname6, join as join8 } from "path";

// src/commands/create.ts
import { existsSync as existsSync3, readdirSync } from "fs";
import { resolve } from "path";
import ora2 from "ora";

// src/prompts/project.ts
import inquirer from "inquirer";
async function promptProjectConfig(defaultProjectName) {
  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "projectName",
      message: "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u540D:",
      default: defaultProjectName || "my-project",
      validate: (input) => {
        const regex = /^[a-zA-Z][a-zA-Z0-9_-]{0,49}$/;
        if (!regex.test(input)) {
          return "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u540D\u306F\u82F1\u5B57\u3067\u59CB\u307E\u308A\u3001\u82F1\u6570\u5B57\u30FB\u30CF\u30A4\u30D5\u30F3\u30FB\u30A2\u30F3\u30C0\u30FC\u30B9\u30B3\u30A2\u306E\u307F\u4F7F\u7528\u3067\u304D\u307E\u3059\uFF081\u301C50\u6587\u5B57\uFF09";
        }
        return true;
      }
    },
    {
      type: "confirm",
      name: "useCurrentDir",
      message: "\u4ECA\u3044\u308B\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u306B\u76F4\u63A5\u4F5C\u6210\u3057\u307E\u3059\u304B\uFF1F\uFF08No\u306A\u3089\u30B5\u30D6\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u3092\u4F5C\u6210\uFF09",
      default: false
    },
    {
      type: "input",
      name: "packageScope",
      message: "\u30D1\u30C3\u30B1\u30FC\u30B8\u30B9\u30B3\u30FC\u30D7:",
      default: "@repo",
      validate: (input) => {
        const regex = /^@[a-zA-Z][a-zA-Z0-9_-]{0,49}$/;
        if (!regex.test(input)) {
          return "\u30D1\u30C3\u30B1\u30FC\u30B8\u30B9\u30B3\u30FC\u30D7\u306F@\u3067\u59CB\u307E\u308A\u3001\u82F1\u6570\u5B57\u30FB\u30CF\u30A4\u30D5\u30F3\u30FB\u30A2\u30F3\u30C0\u30FC\u30B9\u30B3\u30A2\u306E\u307F\u4F7F\u7528\u3067\u304D\u307E\u3059";
        }
        return true;
      }
    },
    {
      type: "list",
      name: "authMethod",
      message: "\u8A8D\u8A3C\u6A5F\u80FD:",
      choices: [
        { name: "NextAuth.js \u3092\u4F7F\u7528", value: "default" },
        { name: "\u306A\u3057\uFF08\u8A8D\u8A3C\u30D5\u30A1\u30A4\u30EB\u3092\u9664\u5916\uFF09", value: "none" }
      ],
      default: "default"
    },
    {
      type: "confirm",
      name: "setupEinjaCli",
      message: "@einja/dev-cli \u3092\u81EA\u52D5\u30BB\u30C3\u30C8\u30A2\u30C3\u30D7\u3057\u307E\u3059\u304B\uFF1F",
      default: true
    },
    {
      type: "confirm",
      name: "customizeWorktree",
      message: "Worktree\u8A2D\u5B9A\u3092\u30AB\u30B9\u30BF\u30DE\u30A4\u30BA\u3057\u307E\u3059\u304B\uFF1F",
      default: false
    }
  ]);
  const tools = {
    direnv: true,
    dotenvx: true,
    volta: true,
    biome: true,
    husky: true
  };
  let worktreeConfig;
  if (answers.customizeWorktree) {
    const worktreeAnswers = await inquirer.prompt([
      {
        type: "input",
        name: "postgresPort",
        message: "PostgreSQL\u30DD\u30FC\u30C8\u756A\u53F7:",
        default: "25432",
        validate: (input) => {
          const port = Number.parseInt(input, 10);
          if (Number.isNaN(port) || port < 1024 || port > 65535) {
            return "\u30DD\u30FC\u30C8\u756A\u53F7\u306F1024\u301C65535\u306E\u7BC4\u56F2\u3067\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044";
          }
          return true;
        }
      },
      {
        type: "input",
        name: "containerName",
        message: "Docker\u30B3\u30F3\u30C6\u30CA\u540D:",
        default: `${answers.projectName}-postgres`
      },
      {
        type: "input",
        name: "appId",
        message: "\u30A2\u30D7\u30EA\u30B1\u30FC\u30B7\u30E7\u30F3ID:",
        default: "web"
      },
      {
        type: "input",
        name: "portRangeStart",
        message: "\u30A2\u30D7\u30EA\u30DD\u30FC\u30C8\u7BC4\u56F2\u958B\u59CB:",
        default: "3000",
        validate: (input) => {
          const port = Number.parseInt(input, 10);
          if (Number.isNaN(port) || port < 1024 || port > 65535) {
            return "\u30DD\u30FC\u30C8\u756A\u53F7\u306F1024\u301C65535\u306E\u7BC4\u56F2\u3067\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044";
          }
          return true;
        }
      },
      {
        type: "input",
        name: "rangeSize",
        message: "\u30DD\u30FC\u30C8\u7BC4\u56F2\u30B5\u30A4\u30BA:",
        default: "1000",
        validate: (input) => {
          const size = Number.parseInt(input, 10);
          if (Number.isNaN(size) || size < 1 || size > 1e4) {
            return "\u7BC4\u56F2\u30B5\u30A4\u30BA\u306F1\u301C10000\u306E\u7BC4\u56F2\u3067\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044";
          }
          return true;
        }
      }
    ]);
    worktreeConfig = {
      postgres: {
        port: Number.parseInt(worktreeAnswers.postgresPort, 10),
        containerName: worktreeAnswers.containerName
      },
      apps: [
        {
          id: worktreeAnswers.appId,
          portRangeStart: Number.parseInt(worktreeAnswers.portRangeStart, 10),
          rangeSize: Number.parseInt(worktreeAnswers.rangeSize, 10)
        }
      ]
    };
  }
  return {
    projectName: answers.projectName,
    packageScope: answers.packageScope,
    template: "default",
    authMethod: answers.authMethod,
    tools,
    setupEinjaCli: answers.setupEinjaCli,
    worktreeConfig,
    useCurrentDir: answers.useCurrentDir
  };
}

// src/generators/template.ts
import fsExtra from "fs-extra";
import { glob } from "glob";
import { dirname as dirname2, join as join2, relative } from "path";
import { fileURLToPath } from "url";

// src/utils/fs.ts
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
function ensureDir(dirPath) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

// src/utils/logger.ts
import chalk from "chalk";
function info(message) {
  console.log(chalk.blue("\u2139"), message);
}
function success(message) {
  console.log(chalk.green("\u2714"), message);
}
function warn(message) {
  console.log(chalk.yellow("\u26A0"), message);
}
function error(message) {
  console.error(chalk.red("\u2716"), message);
}

// src/generators/template.ts
var { copySync, readFileSync: readFileSync2, writeFileSync: writeFileSync2, existsSync: existsSync2, removeSync } = fsExtra;
function getTemplatePath(templateName) {
  const __filename3 = fileURLToPath(import.meta.url);
  const __dirname3 = dirname2(__filename3);
  const distPath = join2(__dirname3, "../templates", templateName);
  const srcPath = join2(__dirname3, "../../templates", templateName);
  if (existsSync2(distPath)) {
    return distPath;
  }
  if (existsSync2(srcPath)) {
    return srcPath;
  }
  return distPath;
}
function getAuthExcludePatterns(authMethod) {
  if (authMethod === "none") {
    return [
      "**/api/auth/**",
      "**/packages/auth/**",
      "**/signin/**",
      "**/signup/**"
    ];
  }
  return [];
}
function replacePlaceholders(content, variables) {
  let result = content;
  result = result.replaceAll("{{projectName}}", variables.projectName);
  result = result.replaceAll("{{packageName}}/", `${variables.packageName}/`);
  result = result.replaceAll("{{packageName}}", variables.packageName);
  result = result.replaceAll("{{description}}", variables.description);
  result = result.replaceAll("@repo/", `${variables.packageName}/`);
  return result;
}
function processFileVariables(filePath, variables) {
  const binaryExtensions = [".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".woff2", ".ttf", ".eot"];
  if (binaryExtensions.some((ext) => filePath.endsWith(ext))) {
    return;
  }
  try {
    const content = readFileSync2(filePath, "utf-8");
    const replaced = replacePlaceholders(content, variables);
    if (content !== replaced) {
      writeFileSync2(filePath, replaced, "utf-8");
    }
  } catch (error2) {
    warn(`\u5909\u6570\u7F6E\u63DB\u3092\u30B9\u30AD\u30C3\u30D7: ${filePath}`);
  }
}
function renameTemplateFiles(targetPath) {
  const templateFiles = glob.sync("**/*.template", {
    cwd: targetPath,
    absolute: true,
    dot: true
  });
  for (const file of templateFiles) {
    const newPath = file.replace(/\.template$/, "");
    copySync(file, newPath);
    removeSync(file);
  }
}
function renameSpecialFiles(targetPath) {
  const gitignoreFiles = glob.sync("**/gitignore", {
    cwd: targetPath,
    absolute: true,
    dot: true
  });
  for (const file of gitignoreFiles) {
    const dir = dirname2(file);
    const newPath = join2(dir, ".gitignore");
    if (existsSync2(file)) {
      copySync(file, newPath);
      removeSync(file);
    }
  }
}
function excludeAuthFiles(targetPath, authMethod) {
  const excludePatterns = getAuthExcludePatterns(authMethod);
  if (excludePatterns.length === 0) {
    return;
  }
  info("\u8A8D\u8A3C\u65B9\u5F0F\u306B\u5FDC\u3058\u305F\u30D5\u30A1\u30A4\u30EB\u3092\u9664\u5916\u4E2D...");
  for (const pattern of excludePatterns) {
    const files = glob.sync(pattern, {
      cwd: targetPath,
      absolute: true,
      dot: true
    });
    for (const file of files) {
      removeSync(file);
    }
  }
}
async function generateTemplate(config, targetPath) {
  const templatePath = getTemplatePath(config.template);
  if (!existsSync2(templatePath)) {
    throw new Error(`\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093: ${config.template}`);
  }
  info("\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u3092\u30B3\u30D4\u30FC\u4E2D...");
  await ensureDir(targetPath);
  copySync(templatePath, targetPath, {
    filter: (src) => {
      const relativePath = relative(templatePath, src);
      const excludePatterns = [
        "node_modules",
        ".git",
        ".next",
        ".turbo",
        "out",
        "dist",
        "logs",
        ".env",
        // フェイルセーフ（暗号化キーファイル）
        ".DS_Store",
        "Thumbs.db",
        "coverage"
      ];
      const excludeExtensions = [".log"];
      const pathSegments = relativePath.split(/[/\\]/);
      const matchesExcludePattern = excludePatterns.some(
        (pattern) => pathSegments.includes(pattern)
      );
      const matchesExtension = excludeExtensions.some(
        (ext) => relativePath.endsWith(ext)
      );
      return !matchesExcludePattern && !matchesExtension;
    }
  });
  excludeAuthFiles(targetPath, config.authMethod);
  renameTemplateFiles(targetPath);
  renameSpecialFiles(targetPath);
  info("\u30D7\u30EC\u30FC\u30B9\u30DB\u30EB\u30C0\u30FC\u5909\u6570\u3092\u7F6E\u63DB\u4E2D...");
  const variables = {
    projectName: config.projectName,
    packageName: config.packageScope,
    description: `${config.projectName} - Einja Management Template`
  };
  const allFiles = glob.sync("**/*", {
    cwd: targetPath,
    absolute: true,
    nodir: true,
    dot: true
  });
  for (const file of allFiles) {
    processFileVariables(file, variables);
  }
  success("\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u5C55\u958B\u5B8C\u4E86");
}

// src/generators/post-setup.ts
import { execa, execaSync } from "execa";
import chalk2 from "chalk";
import inquirer2 from "inquirer";
import ora from "ora";
function isDirenvAvailable() {
  try {
    execaSync("which", ["direnv"]);
    return true;
  } catch {
    return false;
  }
}
async function promptAndExecuteDirenvAllow(targetPath) {
  try {
    const { shouldAllow } = await inquirer2.prompt([
      {
        type: "confirm",
        name: "shouldAllow",
        message: "direnv allow \u3092\u5B9F\u884C\u3057\u307E\u3059\u304B\uFF1F\uFF08\u74B0\u5883\u5909\u6570\u3092\u6709\u52B9\u5316\u3057\u307E\u3059\uFF09",
        default: true
      }
    ]);
    if (shouldAllow) {
      try {
        await execa("direnv", ["allow"], { cwd: targetPath });
        success("direnv allow \u3092\u5B9F\u884C\u3057\u307E\u3057\u305F");
      } catch (error2) {
        warn("direnv allow \u306E\u5B9F\u884C\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
        info("\u5F8C\u3067\u624B\u52D5\u3067 'direnv allow' \u3092\u5B9F\u884C\u3057\u3066\u304F\u3060\u3055\u3044");
      }
    } else {
      info("direnv allow \u3092\u30B9\u30AD\u30C3\u30D7\u3057\u307E\u3057\u305F");
      info("\u5F8C\u3067\u624B\u52D5\u3067 'direnv allow' \u3092\u5B9F\u884C\u3057\u3066\u304F\u3060\u3055\u3044");
    }
  } catch (error2) {
    info("direnv allow \u3092\u30B9\u30AD\u30C3\u30D7\u3057\u307E\u3057\u305F");
  }
}
function printCompletionMessage(config) {
  console.log();
  success("\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u306E\u4F5C\u6210\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F\uFF01");
  console.log();
  console.log(chalk2.bold("\u6B21\u306E\u30B9\u30C6\u30C3\u30D7:"));
  console.log();
  console.log(chalk2.cyan(`  cd ${config.projectName}`));
  console.log(chalk2.cyan("  pnpm env:update          # \u74B0\u5883\u5909\u6570\u3092\u8A2D\u5B9A"));
  console.log(chalk2.cyan("  pnpm dev                 # PostgreSQL\u8D77\u52D5 + \u958B\u767A\u30B5\u30FC\u30D0\u30FC\u8D77\u52D5"));
  console.log();
  console.log(
    chalk2.yellow("\u26A0 \u30BB\u30AD\u30E5\u30EA\u30C6\u30A3: \u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u306E\u79D8\u5BC6\u9375\u3092\u305D\u306E\u307E\u307E\u4F7F\u7528\u3057\u306A\u3044\u3067\u304F\u3060\u3055\u3044")
  );
  console.log(
    chalk2.gray("  pnpm env:rotate-secrets  # \u79D8\u5BC6\u9375\u3092\u81EA\u5206\u306E\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u7528\u306B\u518D\u751F\u6210")
  );
  console.log();
  console.log(chalk2.gray("\u958B\u767A\u30B5\u30FC\u30D0\u30FC: \u30BF\u30FC\u30DF\u30CA\u30EB\u306B\u8868\u793A\u3055\u308C\u308BURL\u3092\u78BA\u8A8D"));
  console.log();
  console.log(chalk2.gray("\u8A73\u7D30\u306F README.md \u3092\u3054\u78BA\u8A8D\u304F\u3060\u3055\u3044\u3002"));
  console.log();
}
async function execPostSetup(config, targetPath, options) {
  const { skipGit, skipInstall } = options;
  if (!skipGit) {
    const gitSpinner = ora("Git\u30EA\u30DD\u30B8\u30C8\u30EA\u3092\u521D\u671F\u5316\u4E2D...").start();
    try {
      await execa("git", ["init"], { cwd: targetPath });
      await execa("git", ["add", "."], { cwd: targetPath });
      await execa("git", ["commit", "-m", "Initial commit"], { cwd: targetPath });
      gitSpinner.succeed("Git\u30EA\u30DD\u30B8\u30C8\u30EA\u3092\u521D\u671F\u5316\u3057\u307E\u3057\u305F");
    } catch (error2) {
      gitSpinner.fail("Git\u30EA\u30DD\u30B8\u30C8\u30EA\u306E\u521D\u671F\u5316\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
      warn("\u5F8C\u3067\u624B\u52D5\u3067 'git init' \u3092\u5B9F\u884C\u3057\u3066\u304F\u3060\u3055\u3044");
    }
  }
  if (!skipInstall) {
    const installSpinner = ora("\u4F9D\u5B58\u95A2\u4FC2\u3092\u30A4\u30F3\u30B9\u30C8\u30FC\u30EB\u4E2D...").start();
    try {
      await execa("pnpm", ["install"], { cwd: targetPath });
      installSpinner.succeed("\u4F9D\u5B58\u95A2\u4FC2\u3092\u30A4\u30F3\u30B9\u30C8\u30FC\u30EB\u3057\u307E\u3057\u305F");
      const prismaSpinner = ora("Prisma\u30AF\u30E9\u30A4\u30A2\u30F3\u30C8\u3092\u751F\u6210\u4E2D...").start();
      try {
        await execa("pnpm", ["db:generate"], { cwd: targetPath });
        prismaSpinner.succeed("Prisma\u30AF\u30E9\u30A4\u30A2\u30F3\u30C8\u3092\u751F\u6210\u3057\u307E\u3057\u305F");
      } catch (error2) {
        prismaSpinner.fail("Prisma\u30AF\u30E9\u30A4\u30A2\u30F3\u30C8\u306E\u751F\u6210\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
        warn("\u5F8C\u3067\u624B\u52D5\u3067 'pnpm db:generate' \u3092\u5B9F\u884C\u3057\u3066\u304F\u3060\u3055\u3044");
      }
    } catch (error2) {
      installSpinner.fail("\u4F9D\u5B58\u95A2\u4FC2\u306E\u30A4\u30F3\u30B9\u30C8\u30FC\u30EB\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
      warn("\u5F8C\u3067\u624B\u52D5\u3067 'pnpm install' \u3092\u5B9F\u884C\u3057\u3066\u304F\u3060\u3055\u3044");
    }
  }
  if (config.tools.direnv && isDirenvAvailable()) {
    await promptAndExecuteDirenvAllow(targetPath);
  }
  if (config.setupEinjaCli) {
    const einjaSpinner = ora("@einja/dev-cli \u3092\u521D\u671F\u5316\u4E2D...").start();
    try {
      await execa("npx", ["@einja/dev-cli", "init", "--force", "--no-backup"], { cwd: targetPath });
      einjaSpinner.succeed("@einja/dev-cli \u3092\u521D\u671F\u5316\u3057\u307E\u3057\u305F");
    } catch (error2) {
      einjaSpinner.fail("@einja/dev-cli \u306E\u521D\u671F\u5316\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
      warn("\u5F8C\u3067\u624B\u52D5\u3067 'npx @einja/dev-cli init' \u3092\u5B9F\u884C\u3057\u3066\u304F\u3060\u3055\u3044");
    }
  }
  printCompletionMessage(config);
}

// src/commands/create.ts
function isDirectoryEmpty(dirPath) {
  if (!existsSync3(dirPath)) {
    return true;
  }
  const files = readdirSync(dirPath);
  const significantFiles = files.filter(
    (f) => !f.startsWith(".")
  );
  return significantFiles.length === 0;
}
function validateProjectName(projectName) {
  const regex = /^[a-zA-Z][a-zA-Z0-9_-]{0,49}$/;
  if (!regex.test(projectName)) {
    return "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u540D\u306F\u82F1\u5B57\u3067\u59CB\u307E\u308A\u3001\u82F1\u6570\u5B57\u30FB\u30CF\u30A4\u30D5\u30F3\u30FB\u30A2\u30F3\u30C0\u30FC\u30B9\u30B3\u30A2\u306E\u307F\u4F7F\u7528\u3067\u304D\u307E\u3059\uFF081\u301C50\u6587\u5B57\uFF09";
  }
  return void 0;
}
function checkProjectExists(targetPath) {
  return existsSync3(targetPath);
}
async function createCommand(projectName, options) {
  try {
    let config;
    if (options.yes && projectName) {
      const error2 = validateProjectName(projectName);
      if (error2) {
        error(error2);
        process.exit(1);
      }
      config = {
        projectName,
        packageScope: "@repo",
        template: "default",
        authMethod: "default",
        tools: {
          direnv: true,
          dotenvx: true,
          volta: true,
          biome: true,
          husky: true
        },
        setupEinjaCli: true,
        worktreeConfig: void 0,
        useCurrentDir: false
      };
      info(`\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u540D: ${config.projectName}`);
      info(`\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8: ${config.template}`);
      info(`\u8A8D\u8A3C\u65B9\u5F0F: ${config.authMethod}`);
    } else {
      config = await promptProjectConfig(projectName);
    }
    const targetPath = config.useCurrentDir ? process.cwd() : resolve(process.cwd(), config.projectName);
    if (config.useCurrentDir) {
      if (!isDirectoryEmpty(targetPath)) {
        error("\u73FE\u5728\u306E\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u306B\u30D5\u30A1\u30A4\u30EB\u304C\u5B58\u5728\u3057\u307E\u3059");
        info("\u7A7A\u306E\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u3067\u5B9F\u884C\u3059\u308B\u304B\u3001\u30B5\u30D6\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u3092\u4F5C\u6210\u3057\u3066\u304F\u3060\u3055\u3044");
        process.exit(1);
      }
    } else {
      if (checkProjectExists(targetPath)) {
        error(`\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA '${config.projectName}' \u306F\u65E2\u306B\u5B58\u5728\u3057\u307E\u3059`);
        info("\u5225\u306E\u540D\u524D\u3092\u6307\u5B9A\u3059\u308B\u304B\u3001\u65E2\u5B58\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u3092\u524A\u9664\u3057\u3066\u304F\u3060\u3055\u3044");
        process.exit(1);
      }
    }
    const spinner = ora2("\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u3092\u4F5C\u6210\u4E2D...").start();
    try {
      await generateTemplate(config, targetPath);
      spinner.succeed("\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u3092\u4F5C\u6210\u3057\u307E\u3057\u305F");
    } catch (error2) {
      spinner.fail("\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u306E\u4F5C\u6210\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
      throw error2;
    }
    await execPostSetup(config, targetPath, {
      skipGit: options.skipGit,
      skipInstall: options.skipInstall
    });
  } catch (error2) {
    error("\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F:");
    if (error2 instanceof Error) {
      error(error2.message);
    } else {
      error(String(error2));
    }
    process.exit(1);
  }
}

// src/commands/sync.ts
import { dirname as dirname5, join as join7 } from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import fsExtra3 from "fs-extra";
import inquirer5 from "inquirer";

// src/generators/sync.ts
import { glob as glob2 } from "glob";
var CATEGORY_PATTERNS = {
  env: [".env*", ".envrc", ".volta", ".node-version"],
  tools: ["biome.json", ".prettierrc*", ".editorconfig", ".vscode/**"],
  git: [".gitignore", ".gitattributes"],
  "git-hooks": [".husky/**"],
  github: [".github/workflows/**", ".github/actions/**", ".github/dependabot.yml"],
  docker: ["Dockerfile*", "docker-compose*.yml", ".dockerignore"],
  monorepo: ["turbo.json", "pnpm-workspace.yaml"],
  "root-config": ["package.json", "tsconfig.json"],
  scripts: ["scripts/**"],
  apps: ["apps/**"],
  packages: ["packages/**"],
  docs: ["README.md", "docs/**"]
};
var ENV_FILE_PROTECTION = {
  // 同期から保護するファイル（秘密鍵・暗号化済み値を含む）
  protected: [
    ".env.keys",
    ".env.personal",
    ".env.develop",
    ".env.local",
    ".env.production",
    ".env.staging",
    ".env.preview"
  ],
  // 同期を許可するファイル（テンプレート・例示ファイル）
  allowed: [
    ".env.example",
    ".env.personal.example",
    ".envrc"
  ]
};
var SYNC_EXCLUDE_PATTERNS = [
  "**/prisma/schema.prisma",
  // DBモデルはユーザー固有
  "**/prisma/migrations/**",
  // マイグレーション履歴
  "pnpm-lock.yaml",
  // lockfile は sync すべきでない
  "**/node_modules/**",
  // 依存関係
  "**/.git/**"
  // Git内部
];
function isProtectedEnvFile(filePath) {
  const fileName = filePath.split("/").pop() ?? "";
  if (ENV_FILE_PROTECTION.allowed.some((pattern) => fileName === pattern)) {
    return false;
  }
  if (ENV_FILE_PROTECTION.protected.some((pattern) => fileName === pattern)) {
    return true;
  }
  if (fileName.startsWith(".env")) {
    return true;
  }
  return false;
}
function isExcludedFile(filePath) {
  for (const pattern of SYNC_EXCLUDE_PATTERNS) {
    const regexPattern = pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*").replace(/\./g, "\\.");
    const regex = new RegExp(`^${regexPattern}$`);
    if (regex.test(filePath)) {
      return true;
    }
  }
  return false;
}
function extractPatternsFromCategories(categories, appsDetail, packagesDetail) {
  const patterns = [];
  for (const category of categories) {
    const categoryPatterns = CATEGORY_PATTERNS[category];
    if (!categoryPatterns) {
      warn(`\u4E0D\u660E\u306A\u30AB\u30C6\u30B4\u30EA: ${category}`);
      continue;
    }
    if (category === "apps" && appsDetail && appsDetail.length > 0) {
      patterns.push(...appsDetail.map((app) => `apps/${app}/**`));
    } else if (category === "packages" && packagesDetail && packagesDetail.length > 0) {
      patterns.push(...packagesDetail.map((pkg) => `packages/${pkg}/**`));
    } else {
      patterns.push(...categoryPatterns);
    }
  }
  return patterns;
}
async function collectSyncFiles(templateDir, categories, appsDetail, packagesDetail) {
  try {
    info("\u540C\u671F\u5BFE\u8C61\u30D5\u30A1\u30A4\u30EB\u3092\u53CE\u96C6\u4E2D...");
    const patterns = extractPatternsFromCategories(
      categories,
      appsDetail,
      packagesDetail
    );
    if (patterns.length === 0) {
      warn("\u540C\u671F\u5BFE\u8C61\u306E\u30D1\u30BF\u30FC\u30F3\u304C\u3042\u308A\u307E\u305B\u3093");
      return [];
    }
    const fileSet = /* @__PURE__ */ new Set();
    for (const pattern of patterns) {
      try {
        const files = await glob2(pattern, {
          cwd: templateDir,
          dot: true,
          // .で始まるファイルも含める
          nodir: true
          // ディレクトリは除外
        });
        for (const file of files) {
          fileSet.add(file);
        }
      } catch (error2) {
        warn(`\u30D1\u30BF\u30FC\u30F3 ${pattern} \u306E\u51E6\u7406\u4E2D\u306B\u30A8\u30E9\u30FC: ${error2}`);
      }
    }
    const allFiles = Array.from(fileSet);
    const filteredFiles = allFiles.filter((file) => {
      if (isProtectedEnvFile(file)) {
        info(`\u4FDD\u8B77\u5BFE\u8C61\u30D5\u30A1\u30A4\u30EB\u3092\u9664\u5916: ${file}`);
        return false;
      }
      if (isExcludedFile(file)) {
        info(`\u9664\u5916\u30D1\u30BF\u30FC\u30F3\u306B\u30DE\u30C3\u30C1: ${file}`);
        return false;
      }
      return true;
    });
    success(`${filteredFiles.length}\u500B\u306E\u30D5\u30A1\u30A4\u30EB\u3092\u53CE\u96C6\u3057\u307E\u3057\u305F`);
    return filteredFiles.sort();
  } catch (error2) {
    error(`\u30D5\u30A1\u30A4\u30EB\u53CE\u96C6\u4E2D\u306B\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F: ${error2}`);
    throw error2;
  }
}

// src/prompts/sync.ts
import inquirer3 from "inquirer";
import * as fs from "fs";
import * as path from "path";
var CATEGORY_CONFIGS = {
  env: {
    name: "\u74B0\u5883\u8A2D\u5B9A",
    description: ".env*, .envrc, .volta, .node-version",
    patterns: [".env*", ".envrc", ".volta", ".node-version"],
    defaultChecked: true,
    firstRunDefault: true
  },
  tools: {
    name: "\u958B\u767A\u30C4\u30FC\u30EB",
    description: "biome.json, .prettierrc, .editorconfig, .vscode/",
    patterns: ["biome.json", ".prettierrc*", ".editorconfig", ".vscode/"],
    defaultChecked: true,
    firstRunDefault: true
  },
  git: {
    name: "Git\u8A2D\u5B9A",
    description: ".gitignore, .gitattributes",
    patterns: [".gitignore", ".gitattributes"],
    defaultChecked: false,
    firstRunDefault: true
  },
  "git-hooks": {
    name: "Git Hooks",
    description: ".husky/",
    patterns: [".husky/"],
    defaultChecked: false,
    firstRunDefault: true
  },
  github: {
    name: "CI/CD",
    description: ".github/workflows/, .github/actions/",
    patterns: [".github/workflows/", ".github/actions/", ".github/dependabot.yml"],
    defaultChecked: false
  },
  docker: {
    name: "\u30B3\u30F3\u30C6\u30CA",
    description: "Dockerfile*, docker-compose.yml, .dockerignore",
    patterns: ["Dockerfile*", "docker-compose*.yml", ".dockerignore"],
    defaultChecked: false
  },
  monorepo: {
    name: "\u30E2\u30CE\u30EC\u30DD\u69CB\u6210",
    description: "turbo.json, pnpm-workspace.yaml",
    patterns: ["turbo.json", "pnpm-workspace.yaml"],
    defaultChecked: false,
    firstRunDefault: true
  },
  "root-config": {
    name: "\u30EB\u30FC\u30C8\u8A2D\u5B9A",
    description: "package.json, tsconfig.json",
    patterns: ["package.json", "tsconfig.json"],
    defaultChecked: false,
    firstRunDefault: true
  },
  scripts: {
    name: "\u30B9\u30AF\u30EA\u30D7\u30C8",
    description: "scripts/ \u914D\u4E0B",
    patterns: ["scripts/**"],
    defaultChecked: false
  },
  apps: {
    name: "\u30A2\u30D7\u30EA\u30B1\u30FC\u30B7\u30E7\u30F3",
    description: "apps/ \u914D\u4E0B\uFF08\u6B21\u306E\u753B\u9762\u3067\u500B\u5225\u9078\u629E\uFF09",
    patterns: ["apps/**"],
    defaultChecked: false,
    firstRunDefault: true,
    requiresDetailSelection: true
  },
  packages: {
    name: "\u5171\u901A\u30D1\u30C3\u30B1\u30FC\u30B8",
    description: "packages/ \u914D\u4E0B\uFF08\u6B21\u306E\u753B\u9762\u3067\u500B\u5225\u9078\u629E\uFF09",
    patterns: ["packages/**"],
    defaultChecked: false,
    firstRunDefault: true,
    requiresDetailSelection: true
  },
  docs: {
    name: "\u30C9\u30AD\u30E5\u30E1\u30F3\u30C8",
    description: "README.md, docs/",
    patterns: ["README.md", "docs/**"],
    defaultChecked: false
  }
};
function getAvailableApps(templateDir) {
  const appsDir = path.join(templateDir, "apps");
  try {
    if (!fs.existsSync(appsDir)) {
      return [];
    }
    return fs.readdirSync(appsDir, { withFileTypes: true }).filter((dirent) => dirent.isDirectory()).map((dirent) => dirent.name);
  } catch (error2) {
    console.error(`Error reading apps directory: ${error2}`);
    return [];
  }
}
function getAvailablePackages(templateDir) {
  const packagesDir = path.join(templateDir, "packages");
  try {
    if (!fs.existsSync(packagesDir)) {
      return [];
    }
    return fs.readdirSync(packagesDir, { withFileTypes: true }).filter((dirent) => dirent.isDirectory()).map((dirent) => dirent.name);
  } catch (error2) {
    console.error(`Error reading packages directory: ${error2}`);
    return [];
  }
}
async function promptSyncCategories(templateDir, isFirstRun = false) {
  const categoryAnswers = await inquirer3.prompt([
    {
      type: "checkbox",
      name: "categories",
      message: "\u540C\u671F\u3059\u308B\u9805\u76EE\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\uFF08Space\u3067\u9078\u629E\u3001Enter\u3067\u78BA\u5B9A\uFF09:",
      choices: Object.entries(CATEGORY_CONFIGS).map(([key, config]) => ({
        name: `${config.name} - ${config.description}`,
        value: key,
        checked: isFirstRun ? config.firstRunDefault ?? config.defaultChecked ?? false : config.defaultChecked ?? false
      }))
    }
  ]);
  const selectedCategories = categoryAnswers.categories;
  const hasApps = selectedCategories.includes("apps");
  const hasPackages = selectedCategories.includes("packages");
  const hasRootConfig = selectedCategories.includes("root-config");
  let appsDetail;
  let packagesDetail;
  let packageJsonSections;
  let conflictStrategy = "merge";
  if (hasApps) {
    const availableApps = getAvailableApps(templateDir);
    if (availableApps.length > 0) {
      const appsAnswers = await inquirer3.prompt([
        {
          type: "checkbox",
          name: "apps",
          message: "\u540C\u671F\u3059\u308B\u30A2\u30D7\u30EA\u30B1\u30FC\u30B7\u30E7\u30F3\u3092\u9078\u629E:",
          choices: availableApps.map((app) => ({
            name: app,
            value: app,
            checked: true
          })),
          validate: (input) => {
            if (input.length === 0) {
              return "\u5C11\u306A\u304F\u3068\u30821\u3064\u306E\u30A2\u30D7\u30EA\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044";
            }
            return true;
          }
        }
      ]);
      appsDetail = appsAnswers.apps;
    } else {
      console.warn("\u8B66\u544A: apps/ \u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u304C\u898B\u3064\u304B\u3089\u306A\u3044\u304B\u3001\u30A2\u30D7\u30EA\u304C\u5B58\u5728\u3057\u307E\u305B\u3093");
      appsDetail = [];
    }
  }
  if (hasPackages) {
    const availablePackages = getAvailablePackages(templateDir);
    if (availablePackages.length > 0) {
      const packagesAnswers = await inquirer3.prompt([
        {
          type: "checkbox",
          name: "packages",
          message: "\u540C\u671F\u3059\u308B\u30D1\u30C3\u30B1\u30FC\u30B8\u3092\u9078\u629E:",
          choices: availablePackages.map((pkg) => ({
            name: pkg,
            value: pkg,
            checked: true
          })),
          validate: (input) => {
            if (input.length === 0) {
              return "\u5C11\u306A\u304F\u3068\u30821\u3064\u306E\u30D1\u30C3\u30B1\u30FC\u30B8\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044";
            }
            return true;
          }
        }
      ]);
      packagesDetail = packagesAnswers.packages;
    } else {
      console.warn("\u8B66\u544A: packages/ \u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u304C\u898B\u3064\u304B\u3089\u306A\u3044\u304B\u3001\u30D1\u30C3\u30B1\u30FC\u30B8\u304C\u5B58\u5728\u3057\u307E\u305B\u3093");
      packagesDetail = [];
    }
  }
  if (hasRootConfig) {
    const packageJsonAnswers = await inquirer3.prompt([
      {
        type: "checkbox",
        name: "sections",
        message: "package.json\u306E\u540C\u671F\u30BB\u30AF\u30B7\u30E7\u30F3\u3092\u9078\u629E:",
        choices: [
          { name: "scripts\uFF08\u63A8\u5968\uFF09", value: "scripts", checked: true },
          { name: "engines\uFF08\u63A8\u5968\uFF09", value: "engines", checked: true },
          { name: "dependencies", value: "dependencies", checked: false },
          { name: "devDependencies", value: "devDependencies", checked: false },
          { name: "peerDependencies", value: "peerDependencies", checked: false }
        ]
      }
    ]);
    packageJsonSections = packageJsonAnswers.sections;
  }
  const strategyAnswers = await inquirer3.prompt([
    {
      type: "list",
      name: "conflictStrategy",
      message: "\u7AF6\u5408\u89E3\u6C7A\u6226\u7565\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044:",
      choices: [
        { name: "\u30DE\u30FC\u30AB\u30FC\u30D9\u30FC\u30B9\u30DE\u30FC\u30B8\uFF08\u63A8\u5968\uFF09", value: "merge" },
        { name: "\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u3067\u4E0A\u66F8\u304D", value: "overwrite" },
        { name: "\u65E2\u5B58\u30D5\u30A1\u30A4\u30EB\u512A\u5148", value: "skip" }
      ],
      default: "merge"
    }
  ]);
  conflictStrategy = strategyAnswers.conflictStrategy;
  return {
    categories: selectedCategories,
    appsDetail,
    packagesDetail,
    packageJsonSections,
    conflictStrategy
  };
}

// src/utils/backup.ts
import fsExtra2 from "fs-extra";
import { join as join4, dirname as dirname3, relative as relative2 } from "path";
var { copy, ensureDir: ensureDir2, readdir, remove, pathExists } = fsExtra2;
function getTimestamp() {
  const now = /* @__PURE__ */ new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}
function parseBackupTimestamp(dirName) {
  const match = dirName.match(/^\.einja-sync-backup-(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})$/);
  if (!match || !match[1]) {
    return null;
  }
  const timestampStr = match[1];
  const parts = timestampStr.split("_");
  if (parts.length !== 2) {
    return null;
  }
  const [datePart, timePart] = parts;
  if (!datePart || !timePart) {
    return null;
  }
  const dateParts = datePart.split("-").map(Number);
  const timeParts = timePart.split("-").map(Number);
  if (dateParts.length !== 3 || timeParts.length !== 3) {
    return null;
  }
  const [year, month, day] = dateParts;
  const [hours, minutes, seconds] = timeParts;
  if (year === void 0 || month === void 0 || day === void 0 || hours === void 0 || minutes === void 0 || seconds === void 0) {
    return null;
  }
  return new Date(year, month - 1, day, hours, minutes, seconds);
}
async function createBackup(targetDir, filesToBackup) {
  const timestamp = getTimestamp();
  const backupDirName = `.einja-sync-backup-${timestamp}`;
  const backupDir = join4(targetDir, backupDirName);
  try {
    await ensureDir2(backupDir);
    for (const file of filesToBackup) {
      const sourcePath = join4(targetDir, file);
      const destPath = join4(backupDir, file);
      if (!await pathExists(sourcePath)) {
        continue;
      }
      await ensureDir2(dirname3(destPath));
      await copy(sourcePath, destPath);
    }
    return backupDir;
  } catch (error2) {
    error(`\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u306E\u4F5C\u6210\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${error2 instanceof Error ? error2.message : String(error2)}`);
    throw error2;
  }
}
async function restoreFromBackup(backupDir, targetDir) {
  try {
    if (!await pathExists(backupDir)) {
      error(`\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093: ${backupDir}`);
      return false;
    }
    const files = await getAllFiles(backupDir);
    for (const file of files) {
      const sourcePath = join4(backupDir, file);
      const destPath = join4(targetDir, file);
      await ensureDir2(dirname3(destPath));
      await copy(sourcePath, destPath, { overwrite: true });
    }
    return true;
  } catch (error2) {
    error(`\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u304B\u3089\u306E\u5FA9\u5143\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${error2 instanceof Error ? error2.message : String(error2)}`);
    return false;
  }
}
async function getAllFiles(dirPath, baseDir) {
  const base = baseDir ?? dirPath;
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join4(dirPath, entry.name);
    if (entry.isDirectory()) {
      const subFiles = await getAllFiles(fullPath, base);
      files.push(...subFiles);
    } else {
      files.push(relative2(base, fullPath));
    }
  }
  return files;
}
async function listBackups(targetDir) {
  try {
    if (!await pathExists(targetDir)) {
      return [];
    }
    const entries = await readdir(targetDir, { withFileTypes: true });
    const backups = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const timestamp = parseBackupTimestamp(entry.name);
      if (!timestamp) {
        continue;
      }
      backups.push({
        path: join4(targetDir, entry.name),
        name: entry.name,
        timestamp
      });
    }
    backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return backups;
  } catch (error2) {
    error(`\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u4E00\u89A7\u306E\u53D6\u5F97\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${error2 instanceof Error ? error2.message : String(error2)}`);
    return [];
  }
}
async function getLatestBackup(targetDir) {
  const backups = await listBackups(targetDir);
  return backups.length > 0 ? backups[0] ?? null : null;
}

// src/utils/git.ts
import { execSync } from "child_process";
function isGitRepository(targetDir) {
  try {
    const cwd = targetDir || process.cwd();
    execSync("git rev-parse --is-inside-work-tree", {
      cwd,
      stdio: "ignore"
    });
    return true;
  } catch {
    return false;
  }
}
function hasUncommittedChanges(targetDir) {
  if (!isGitRepository(targetDir)) {
    warn("\u26A0\uFE0F  \u3053\u306E\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u306FGit\u30EA\u30DD\u30B8\u30C8\u30EA\u3067\u306F\u3042\u308A\u307E\u305B\u3093");
    return false;
  }
  try {
    const cwd = targetDir || process.cwd();
    const output = execSync("git status --porcelain", {
      cwd,
      encoding: "utf-8"
    });
    return output.trim().length > 0;
  } catch (error2) {
    warn(`\u26A0\uFE0F  Git\u30B9\u30C6\u30FC\u30BF\u30B9\u78BA\u8A8D\u4E2D\u306B\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F: ${error2}`);
    return false;
  }
}
function checkGitStatusForSync(force, targetDir) {
  if (!isGitRepository(targetDir)) {
    warn("\u26A0\uFE0F  \u3053\u306E\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u306FGit\u30EA\u30DD\u30B8\u30C8\u30EA\u3067\u306F\u3042\u308A\u307E\u305B\u3093");
    warn(
      "   sync\u5B9F\u884C\u5F8C\u306E\u5DEE\u5206\u78BA\u8A8D\u306F `git diff` \u3067\u884C\u3046\u3053\u3068\u3092\u63A8\u5968\u3057\u307E\u3059"
    );
    return true;
  }
  if (hasUncommittedChanges(targetDir)) {
    if (!force) {
      error("\u274C \u672A\u30B3\u30DF\u30C3\u30C8\u306E\u5909\u66F4\u304C\u3042\u308A\u307E\u3059");
      error(
        "   \u5909\u66F4\u3092\u30B3\u30DF\u30C3\u30C8\u3057\u3066\u304B\u3089\u5B9F\u884C\u3059\u308B\u304B\u3001--force \u30D5\u30E9\u30B0\u3092\u4F7F\u7528\u3057\u3066\u304F\u3060\u3055\u3044"
      );
      process.exit(1);
    }
    warn("\u26A0\uFE0F  \u672A\u30B3\u30DF\u30C3\u30C8\u306E\u5909\u66F4\u304C\u3042\u308A\u307E\u3059\u304C\u3001--force \u306B\u3088\u308A\u7D9A\u884C\u3057\u307E\u3059");
    warn(
      "   \u554F\u984C\u304C\u767A\u751F\u3057\u305F\u5834\u5408\u306F `git checkout .` \u3067\u5FA9\u5143\u3067\u304D\u307E\u3059"
    );
  }
  return true;
}

// src/utils/merger.ts
import { readFileSync as readFileSync3, writeFileSync as writeFileSync3, existsSync as existsSync5 } from "fs";
import { dirname as dirname4, basename } from "path";

// src/utils/package-json-merger.ts
import inquirer4 from "inquirer";
function hasVersionConflict(existingVersion, templateVersion) {
  if (existingVersion === templateVersion) {
    return false;
  }
  const normalize = (v) => v.replace(/^[\^~]/, "");
  return normalize(existingVersion) !== normalize(templateVersion);
}
async function mergeDependenciesWithConflictDetection(existing, template) {
  const merged = { ...existing };
  const conflicts = [];
  for (const [packageName, templateVersion] of Object.entries(template)) {
    if (packageName in existing) {
      const existingVersion = existing[packageName];
      if (existingVersion && hasVersionConflict(existingVersion, templateVersion)) {
        conflicts.push({
          packageName,
          existingVersion,
          templateVersion
        });
      } else {
        merged[packageName] = templateVersion;
      }
    } else {
      merged[packageName] = templateVersion;
    }
  }
  return { merged, conflicts };
}
async function resolveVersionConflicts(conflicts) {
  const resolutions = /* @__PURE__ */ new Map();
  warn(`
\u26A0\uFE0F ${conflicts.length}\u500B\u306E\u30D1\u30C3\u30B1\u30FC\u30B8\u3067\u30D0\u30FC\u30B8\u30E7\u30F3\u7AF6\u5408\u304C\u691C\u51FA\u3055\u308C\u307E\u3057\u305F:
`);
  for (const conflict of conflicts) {
    warn(`\u{1F4E6} ${conflict.packageName}`);
    warn(`  \u65E2\u5B58: ${conflict.existingVersion}`);
    warn(`  \u30C6\u30F3\u30D7\u30EC\u30FC\u30C8: ${conflict.templateVersion}
`);
    const answer = await inquirer4.prompt([
      {
        type: "list",
        name: "version",
        message: "\u3069\u3061\u3089\u306E\u30D0\u30FC\u30B8\u30E7\u30F3\u3092\u4F7F\u7528\u3057\u307E\u3059\u304B\uFF1F",
        choices: [
          {
            name: `\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8 (${conflict.templateVersion})`,
            value: "template"
          },
          {
            name: `\u65E2\u5B58 (${conflict.existingVersion})`,
            value: "existing"
          },
          {
            name: "\u30B9\u30AD\u30C3\u30D7\uFF08\u65E2\u5B58\u3092\u7DAD\u6301\uFF09",
            value: "skip"
          }
        ]
      }
    ]);
    if (answer.version === "template") {
      resolutions.set(conflict.packageName, conflict.templateVersion);
    } else if (answer.version === "existing") {
      resolutions.set(conflict.packageName, conflict.existingVersion);
    }
  }
  return resolutions;
}
async function mergePackageJsonDependencies(existingDeps, templateDeps, skipPrompts = false) {
  const { merged, conflicts } = await mergeDependenciesWithConflictDetection(
    existingDeps,
    templateDeps
  );
  if (conflicts.length === 0) {
    return merged;
  }
  if (skipPrompts) {
    info(
      `\u30D0\u30FC\u30B8\u30E7\u30F3\u7AF6\u5408\u304C${conflicts.length}\u500B\u3042\u308A\u307E\u3059\u304C\u3001\u65E2\u5B58\u30D0\u30FC\u30B8\u30E7\u30F3\u3092\u7DAD\u6301\u3057\u307E\u3059`
    );
    return merged;
  }
  const resolutions = await resolveVersionConflicts(conflicts);
  for (const [packageName, version] of resolutions.entries()) {
    merged[packageName] = version;
  }
  return merged;
}

// src/utils/merger.ts
function mergeTextWithMarkers(templateContent, existingContent) {
  if (existingContent === null) {
    return templateContent;
  }
  const templateSections = parseMarkers(templateContent);
  const localSections = parseMarkers(existingContent);
  const hasMarkers = templateSections.some(
    (s) => s.type === "managed" || s.type === "seed"
  );
  if (!hasMarkers) {
    return existingContent;
  }
  const templateManagedById = /* @__PURE__ */ new Map();
  const templateSeedById = /* @__PURE__ */ new Map();
  const templateManagedWithoutId = [];
  const processedTemplateIds = /* @__PURE__ */ new Set();
  for (const section of templateSections) {
    if (section.type === "managed" && section.id) {
      templateManagedById.set(section.id, section);
    } else if (section.type === "managed") {
      templateManagedWithoutId.push(section);
    } else if (section.type === "seed" && section.id) {
      templateSeedById.set(section.id, section);
    }
  }
  const result = [];
  let managedWithoutIdIndex = 0;
  for (const localSection of localSections) {
    if (localSection.type === "managed") {
      const match = localSection.id ? templateManagedById.get(localSection.id) : void 0;
      if (localSection.id && match) {
        processedTemplateIds.add(localSection.id);
        result.push(match.content);
      } else if (!localSection.id) {
        const noIdMatch = templateManagedWithoutId[managedWithoutIdIndex];
        if (noIdMatch) {
          result.push(noIdMatch.content);
          managedWithoutIdIndex += 1;
        } else {
          result.push(localSection.content);
        }
      }
    } else if (localSection.type === "seed") {
      if (localSection.id) {
        processedTemplateIds.add(localSection.id);
      }
      result.push(localSection.content);
    } else {
      result.push(localSection.content);
    }
  }
  for (const [id, section] of templateManagedById) {
    if (!processedTemplateIds.has(id)) {
      result.push(section.content);
    }
  }
  for (const section of templateManagedWithoutId.slice(managedWithoutIdIndex)) {
    result.push(section.content);
  }
  for (const [id, section] of templateSeedById) {
    if (!processedTemplateIds.has(id)) {
      result.push(section.content);
    }
  }
  const firstElement = result[0];
  if (result.length > 0 && firstElement !== void 0 && firstElement.length === 0) {
    result.shift();
  }
  return result.join("\n");
}
function mergeJson(templateJson, existingJson, jsonPaths, filePath = "package.json") {
  if (existingJson === null) {
    return JSON.parse(JSON.stringify(templateJson));
  }
  return deepMergeWithPaths(
    templateJson,
    existingJson,
    jsonPaths,
    filePath,
    ""
  );
}
function deepMergeWithPaths(template, existing, jsonPaths, filePath, currentPath) {
  const result = JSON.parse(JSON.stringify(existing));
  for (const [key, templateValue] of Object.entries(template)) {
    const keyPath = currentPath ? `${currentPath}.${key}` : key;
    const existingValue = existing[key];
    if (isPathManaged(filePath, keyPath, jsonPaths)) {
      result[key] = deepClone(templateValue);
    } else if (isPathSeed(filePath, keyPath, jsonPaths)) {
      if (typeof templateValue === "object" && templateValue !== null && !Array.isArray(templateValue) && typeof existingValue === "object" && existingValue !== null && !Array.isArray(existingValue)) {
        result[key] = deepMergeWithPaths(
          templateValue,
          existingValue,
          jsonPaths,
          filePath,
          keyPath
        );
      } else if (!(key in existing)) {
        result[key] = deepClone(templateValue);
      }
    } else if (typeof templateValue === "object" && templateValue !== null && !Array.isArray(templateValue) && typeof existingValue === "object" && existingValue !== null && !Array.isArray(existingValue)) {
      result[key] = deepMergeWithPaths(
        templateValue,
        existingValue,
        jsonPaths,
        filePath,
        keyPath
      );
    } else if (!(key in existing)) {
      result[key] = deepClone(templateValue);
    }
  }
  return result;
}
function deepClone(value) {
  if (value === void 0) {
    return void 0;
  }
  return JSON.parse(JSON.stringify(value));
}
async function mergePackageJson(existingContent, templateContent, packageJsonSections) {
  const existingPkg = JSON.parse(existingContent);
  const templatePkg = JSON.parse(templateContent);
  const result = { ...existingPkg };
  if ((!packageJsonSections || packageJsonSections.includes("scripts")) && templatePkg.scripts && typeof templatePkg.scripts === "object") {
    result.scripts = {
      ...existingPkg.scripts && typeof existingPkg.scripts === "object" ? existingPkg.scripts : {},
      ...templatePkg.scripts
    };
  }
  if ((!packageJsonSections || packageJsonSections.includes("dependencies")) && templatePkg.dependencies && typeof templatePkg.dependencies === "object") {
    result.dependencies = await mergePackageJsonDependencies(
      existingPkg.dependencies && typeof existingPkg.dependencies === "object" ? existingPkg.dependencies : {},
      templatePkg.dependencies,
      false
    );
  }
  if ((!packageJsonSections || packageJsonSections.includes("devDependencies")) && templatePkg.devDependencies && typeof templatePkg.devDependencies === "object") {
    result.devDependencies = await mergePackageJsonDependencies(
      existingPkg.devDependencies && typeof existingPkg.devDependencies === "object" ? existingPkg.devDependencies : {},
      templatePkg.devDependencies,
      false
    );
  }
  if ((!packageJsonSections || packageJsonSections.includes("engines")) && templatePkg.engines && typeof templatePkg.engines === "object") {
    if (existingPkg.engines && JSON.stringify(existingPkg.engines) !== JSON.stringify(templatePkg.engines)) {
      warn("\u26A0\uFE0F engines \u3092\u7F6E\u63DB\u3057\u307E\u3059:");
      warn(`  \u65E2\u5B58: ${JSON.stringify(existingPkg.engines)}`);
      warn(`  \u65B0\u898F: ${JSON.stringify(templatePkg.engines)}`);
    }
    result.engines = templatePkg.engines;
  }
  return `${JSON.stringify(result, null, 2)}
`;
}
async function mergeAndWriteFile(templatePath, targetPath, syncMetadata, packageJsonSections, conflictStrategy = "merge", templateVariables) {
  let templateContent = readFileSync3(templatePath, "utf-8");
  if (templateVariables) {
    templateContent = replacePlaceholders(templateContent, templateVariables);
  }
  const targetExists = existsSync5(targetPath);
  const existingContent = targetExists ? readFileSync3(targetPath, "utf-8") : null;
  if (targetExists && conflictStrategy === "skip") {
    return { action: "skipped", path: targetPath };
  }
  if (targetExists && conflictStrategy === "overwrite") {
    ensureDir(dirname4(targetPath));
    writeFileSync3(targetPath, templateContent, "utf-8");
    return { action: "overwritten", path: targetPath };
  }
  const isJsonFile = targetPath.endsWith(".json");
  const isPackageJson = basename(targetPath) === "package.json";
  let mergedContent;
  let action;
  if (!targetExists) {
    mergedContent = templateContent;
    action = "created";
  } else if (isPackageJson && existingContent) {
    try {
      mergedContent = await mergePackageJson(existingContent, templateContent, packageJsonSections);
      action = "merged";
    } catch {
      mergedContent = templateContent;
      action = "overwritten";
    }
  } else if (isJsonFile) {
    try {
      const templateJson = JSON.parse(templateContent);
      const existingJson = existingContent ? JSON.parse(existingContent) : null;
      const jsonPaths = syncMetadata.jsonPaths || { managed: {}, seed: {} };
      const fileName = targetPath.split("/").pop() || "package.json";
      const mergedJson = mergeJson(templateJson, existingJson, jsonPaths, fileName);
      mergedContent = JSON.stringify(mergedJson, null, 2);
      action = "merged";
    } catch {
      mergedContent = templateContent;
      action = "overwritten";
    }
  } else {
    mergedContent = mergeTextWithMarkers(templateContent, existingContent);
    if (mergedContent === existingContent) {
      action = "skipped";
    } else {
      action = "merged";
    }
  }
  if (action !== "skipped") {
    ensureDir(dirname4(targetPath));
    writeFileSync3(targetPath, mergedContent, "utf-8");
  }
  return { action, path: targetPath };
}
function parseMarkers(content) {
  const lines = content.split("\n");
  const sections = [];
  let currentType = "unmanaged";
  let currentStartLine = 1;
  let currentContent = [];
  let currentId;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;
    const startMarker = parseStartMarker(line);
    if (startMarker) {
      if (currentType !== "unmanaged") {
        currentContent.push(line);
        continue;
      }
      if (currentContent.length > 0 || sections.length === 0) {
        sections.push({
          type: "unmanaged",
          startLine: currentStartLine,
          endLine: lineNumber - 1,
          content: currentContent.join("\n")
        });
      }
      currentType = startMarker.type;
      currentId = startMarker.id;
      currentStartLine = lineNumber;
      currentContent = [line];
    } else if (parseEndMarker(line)) {
      if (currentType === "unmanaged") {
        currentContent.push(line);
        continue;
      }
      currentContent.push(line);
      sections.push({
        type: currentType,
        startLine: currentStartLine,
        endLine: lineNumber,
        content: currentContent.join("\n"),
        id: currentId
      });
      currentType = "unmanaged";
      currentId = void 0;
      currentStartLine = lineNumber + 1;
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }
  if (currentContent.length > 0 || sections.length === 0) {
    sections.push({
      type: currentType,
      startLine: currentStartLine,
      endLine: lines.length,
      content: currentContent.join("\n"),
      id: currentId
    });
  }
  return sections;
}
function parseStartMarker(line) {
  const markdownManagedPattern = /^<!--\s*@einja:managed:start(?:\s+id="([^"]+)")?\s*-->$/;
  let match = line.match(markdownManagedPattern);
  if (match) {
    return { type: "managed", id: match[1] || void 0 };
  }
  const markdownSeedPattern = /^<!--\s*@einja:seed:start(?:\s+id="([^"]+)")?\s*-->$/;
  match = line.match(markdownSeedPattern);
  if (match) {
    return { type: "seed", id: match[1] || void 0 };
  }
  const yamlManagedPattern = /^\s*#\s*@einja:managed:start(?:\s+id="([^"]+)")?\s*$/;
  match = line.match(yamlManagedPattern);
  if (match) {
    return { type: "managed", id: match[1] || void 0 };
  }
  const yamlSeedPattern = /^\s*#\s*@einja:seed:start(?:\s+id="([^"]+)")?\s*$/;
  match = line.match(yamlSeedPattern);
  if (match) {
    return { type: "seed", id: match[1] || void 0 };
  }
  return null;
}
function parseEndMarker(line) {
  if (/^<!--\s*@einja:managed:end\s*-->$/.test(line)) {
    return "managed";
  }
  if (/^<!--\s*@einja:seed:end\s*-->$/.test(line)) {
    return "seed";
  }
  if (/^\s*#\s*@einja:managed:end\s*$/.test(line)) {
    return "managed";
  }
  if (/^\s*#\s*@einja:seed:end\s*$/.test(line)) {
    return "seed";
  }
  return null;
}
function isPathManaged(filePath, keyPath, jsonPaths) {
  const managedPaths = jsonPaths.managed[filePath] || [];
  return managedPaths.some(
    (p) => keyPath === p || keyPath.startsWith(`${p}.`)
  );
}
function isPathSeed(filePath, keyPath, jsonPaths) {
  const seedPaths = jsonPaths.seed[filePath] || [];
  return seedPaths.some((p) => keyPath === p || keyPath.startsWith(`${p}.`));
}

// src/utils/placeholder-validator.ts
import { readFile } from "fs/promises";
import { join as join5 } from "path";
var PLACEHOLDER_PATTERNS = [
  "@repo/",
  "{{packageName}}",
  "{{projectName}}",
  "{{description}}"
];
var BINARY_EXTENSIONS = /* @__PURE__ */ new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".ico",
  ".svg",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".zip",
  ".tar",
  ".gz",
  ".pdf",
  ".mp4",
  ".mp3"
]);
var EXCLUDED_DIRS = ["node_modules/", ".git/", "dist/", ".next/"];
function isBinaryFile(filePath) {
  const lastDot = filePath.lastIndexOf(".");
  if (lastDot === -1) return false;
  const ext = filePath.substring(lastDot).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}
function isExcludedDir(filePath) {
  return EXCLUDED_DIRS.some((dir) => filePath.includes(dir));
}
async function validatePlaceholders(targetDir, filePaths) {
  const violations = [];
  for (const filePath of filePaths) {
    if (isBinaryFile(filePath) || isExcludedDir(filePath)) {
      continue;
    }
    try {
      const fullPath = join5(targetDir, filePath);
      const content = await readFile(fullPath, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? "";
        for (const pattern of PLACEHOLDER_PATTERNS) {
          if (line.includes(pattern)) {
            violations.push({
              filePath,
              line: i + 1,
              placeholder: pattern,
              context: line.trim()
            });
          }
        }
      }
    } catch {
    }
  }
  return {
    isValid: violations.length === 0,
    violations
  };
}

// src/utils/project-detector.ts
import { readFileSync as readFileSync4, existsSync as existsSync6, readdirSync as readdirSync3, statSync } from "fs";
import { join as join6 } from "path";
async function detectProjectConfig(targetDir) {
  let projectName = null;
  let packageScope = null;
  const rootPackageJsonPath = join6(targetDir, "package.json");
  if (existsSync6(rootPackageJsonPath)) {
    try {
      const rootPkg = JSON.parse(
        readFileSync4(rootPackageJsonPath, "utf-8")
      );
      if (rootPkg.name) {
        projectName = rootPkg.name;
      }
    } catch {
    }
  }
  const candidateDirs = [join6(targetDir, "apps"), join6(targetDir, "packages")];
  for (const dir of candidateDirs) {
    if (!existsSync6(dir)) {
      continue;
    }
    try {
      const entries = readdirSync3(dir);
      for (const entry of entries) {
        const entryPath = join6(dir, entry);
        if (!statSync(entryPath).isDirectory()) {
          continue;
        }
        const pkgJsonPath = join6(entryPath, "package.json");
        if (!existsSync6(pkgJsonPath)) {
          continue;
        }
        try {
          const pkg = JSON.parse(
            readFileSync4(pkgJsonPath, "utf-8")
          );
          if (pkg.name) {
            const match = pkg.name.match(/^(@[^/]+)\//);
            if (match?.[1]) {
              const detectedScope = match[1];
              if (packageScope && packageScope !== detectedScope) {
                console.warn(
                  `\u8B66\u544A: \u7570\u306A\u308B\u30B9\u30B3\u30FC\u30D7\u304C\u691C\u51FA\u3055\u308C\u307E\u3057\u305F\uFF08${packageScope} vs ${detectedScope}\uFF09\u3002\u6700\u521D\u306B\u898B\u3064\u304B\u3063\u305F ${packageScope} \u3092\u4F7F\u7528\u3057\u307E\u3059\u3002`
                );
              } else if (!packageScope) {
                packageScope = detectedScope;
              }
            }
          }
        } catch {
        }
      }
    } catch {
    }
  }
  if (projectName && packageScope) {
    return { projectName, packageScope };
  }
  return null;
}

// src/commands/sync.ts
var currentBackupDir;
var isSyncing = false;
async function handleInterrupt() {
  if (!isSyncing) {
    info("\n\n\u51E6\u7406\u3092\u4E2D\u65AD\u3057\u307E\u3057\u305F");
    process.exit(0);
  }
  info("\n\n\u{1F6D1} \u540C\u671F\u51E6\u7406\u3092\u4E2D\u65AD\u3057\u3066\u3044\u307E\u3059...");
  if (!currentBackupDir) {
    info("\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u304C\u4F5C\u6210\u3055\u308C\u3066\u3044\u306A\u3044\u305F\u3081\u3001\u30AF\u30EA\u30FC\u30F3\u30A2\u30C3\u30D7\u306F\u4E0D\u8981\u3067\u3059");
    process.exit(0);
  }
  const answer = await inquirer5.prompt([
    {
      type: "confirm",
      name: "rollback",
      message: "\u5909\u66F4\u3092\u30ED\u30FC\u30EB\u30D0\u30C3\u30AF\u3057\u307E\u3059\u304B\uFF1F",
      default: true
    }
  ]);
  if (answer.rollback) {
    info("\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u304B\u3089\u5FA9\u5143\u4E2D...");
    const targetDir = process.cwd();
    const success2 = await restoreFromBackup(currentBackupDir, targetDir);
    if (success2) {
      success("\u2713 \u30ED\u30FC\u30EB\u30D0\u30C3\u30AF\u5B8C\u4E86");
    } else {
      error("\u274C \u30ED\u30FC\u30EB\u30D0\u30C3\u30AF\u5931\u6557");
      info(`\u624B\u52D5\u3067\u5FA9\u5143: cp -r ${currentBackupDir}/* .`);
    }
  }
  process.exit(0);
}
function getTemplatePath2() {
  const __filename3 = fileURLToPath2(import.meta.url);
  const __dirname3 = dirname5(__filename3);
  const { existsSync: existsSync7 } = fsExtra3;
  const distPath = join7(__dirname3, "../templates/default");
  const srcPath = join7(__dirname3, "../../templates/default");
  if (existsSync7(distPath)) {
    return distPath;
  }
  if (existsSync7(srcPath)) {
    return srcPath;
  }
  throw new Error("\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
}
async function syncCommand(options) {
  const { existsSync: existsSync7 } = fsExtra3;
  const sigintHandler = () => {
    handleInterrupt().catch((error2) => {
      error(`\u30AF\u30EA\u30FC\u30F3\u30A2\u30C3\u30D7\u4E2D\u306B\u30A8\u30E9\u30FC: ${error2}`);
      process.exit(1);
    });
  };
  process.on("SIGINT", sigintHandler);
  const cleanup = () => {
    process.off("SIGINT", sigintHandler);
  };
  try {
    if (options.rollback) {
      info("\u{1F504} \u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u304B\u3089\u30ED\u30FC\u30EB\u30D0\u30C3\u30AF\u4E2D...");
      const targetDir2 = process.cwd();
      const latestBackup = await getLatestBackup(targetDir2);
      if (!latestBackup) {
        error("\u274C \u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
        process.exit(1);
      }
      info(`\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7: ${latestBackup.name}`);
      const success2 = await restoreFromBackup(latestBackup.path, targetDir2);
      if (success2) {
        success("\u2713 \u30ED\u30FC\u30EB\u30D0\u30C3\u30AF\u5B8C\u4E86");
      } else {
        error("\u274C \u30ED\u30FC\u30EB\u30D0\u30C3\u30AF\u5931\u6557");
        process.exit(1);
      }
      return;
    }
    const targetDir = process.cwd();
    checkGitStatusForSync(options.force || false, targetDir);
    const templatePath = getTemplatePath2();
    let categories;
    let appsDetail;
    let packagesDetail;
    let conflictStrategy;
    let packageJsonSections;
    if (options.all) {
      categories = [
        "env",
        "tools",
        "git",
        "git-hooks",
        "github",
        "docker",
        "monorepo",
        "root-config",
        "apps",
        "packages",
        "docs"
      ];
      appsDetail = void 0;
      packagesDetail = void 0;
      conflictStrategy = "merge";
      info("\u5168\u30AB\u30C6\u30B4\u30EA\u3092\u540C\u671F\u5BFE\u8C61\u306B\u8A2D\u5B9A\u3057\u307E\u3057\u305F");
    } else if (options.categories) {
      categories = options.categories;
      appsDetail = void 0;
      packagesDetail = void 0;
      conflictStrategy = "merge";
      info(`\u6307\u5B9A\u3055\u308C\u305F\u30AB\u30C6\u30B4\u30EA: ${categories.join(", ")}`);
    } else {
      const promptResult = await promptSyncCategories(templatePath);
      categories = promptResult.categories;
      appsDetail = promptResult.appsDetail;
      packagesDetail = promptResult.packagesDetail;
      conflictStrategy = promptResult.conflictStrategy;
      packageJsonSections = promptResult.packageJsonSections;
    }
    info("\u{1F4C1} \u540C\u671F\u5BFE\u8C61\u30D5\u30A1\u30A4\u30EB\u3092\u53CE\u96C6\u4E2D...");
    const filesToSync = await collectSyncFiles(templatePath, categories, appsDetail, packagesDetail);
    if (filesToSync.length === 0) {
      warn("\u26A0\uFE0F \u540C\u671F\u5BFE\u8C61\u306E\u30D5\u30A1\u30A4\u30EB\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
      return;
    }
    info(`\u540C\u671F\u5BFE\u8C61: ${filesToSync.length}\u500B\u306E\u30D5\u30A1\u30A4\u30EB`);
    let templateVariables;
    info("\u{1F50D} \u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u8A2D\u5B9A\u3092\u691C\u51FA\u4E2D...");
    const detectedConfig = await detectProjectConfig(targetDir);
    if (detectedConfig) {
      templateVariables = {
        projectName: detectedConfig.projectName,
        packageName: detectedConfig.packageScope,
        description: `${detectedConfig.projectName} - Einja Management Template`
      };
      info(`  \u2713 \u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u540D: ${detectedConfig.projectName}`);
      info(`  \u2713 \u30D1\u30C3\u30B1\u30FC\u30B8\u30B9\u30B3\u30FC\u30D7: ${detectedConfig.packageScope}`);
    } else {
      warn("\u26A0\uFE0F \u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u8A2D\u5B9A\u3092\u81EA\u52D5\u691C\u51FA\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F");
      const inputAnswers = await inquirer5.prompt([
        {
          type: "input",
          name: "projectName",
          message: "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u540D\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044:",
          validate: (input) => {
            if (!input.trim()) {
              return "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u540D\u306F\u5FC5\u9808\u3067\u3059";
            }
            return true;
          }
        },
        {
          type: "input",
          name: "packageScope",
          message: "\u30D1\u30C3\u30B1\u30FC\u30B8\u30B9\u30B3\u30FC\u30D7\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\uFF08\u4F8B: @mycompany\uFF09:",
          validate: (input) => {
            if (!input.trim()) {
              return "\u30D1\u30C3\u30B1\u30FC\u30B8\u30B9\u30B3\u30FC\u30D7\u306F\u5FC5\u9808\u3067\u3059";
            }
            if (!input.startsWith("@")) {
              return "\u30D1\u30C3\u30B1\u30FC\u30B8\u30B9\u30B3\u30FC\u30D7\u306F @ \u3067\u59CB\u307E\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059\uFF08\u4F8B: @mycompany\uFF09";
            }
            return true;
          }
        }
      ]);
      templateVariables = {
        projectName: inputAnswers.projectName,
        packageName: inputAnswers.packageScope,
        description: `${inputAnswers.projectName} - Einja Management Template`
      };
    }
    if (options.dryRun) {
      info("\n\u{1F4CB} \u540C\u671F\u30D7\u30EC\u30D3\u30E5\u30FC (--dry-run)\n");
      for (const file of filesToSync) {
        info(`  \u2713 ${file}`);
      }
      info(`
\u5408\u8A08: ${filesToSync.length}\u30D5\u30A1\u30A4\u30EB`);
      info("--dry-run \u30E2\u30FC\u30C9\u306E\u305F\u3081\u3001\u5B9F\u969B\u306E\u30D5\u30A1\u30A4\u30EB\u5909\u66F4\u306F\u884C\u308F\u308C\u307E\u305B\u3093");
      return;
    }
    let backupDir;
    if (options.backup !== false) {
      info("\u{1F4BE} \u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u4F5C\u6210\u4E2D...");
      const existingFiles = filesToSync.filter((file) => existsSync7(join7(targetDir, file)));
      if (existingFiles.length > 0) {
        backupDir = await createBackup(targetDir, existingFiles);
        currentBackupDir = backupDir;
      } else {
        info("\u65E2\u5B58\u30D5\u30A1\u30A4\u30EB\u304C\u306A\u3044\u305F\u3081\u3001\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u3092\u30B9\u30AD\u30C3\u30D7\u3057\u307E\u3059");
      }
    }
    info("\u{1F504} \u30D5\u30A1\u30A4\u30EB\u540C\u671F\u4E2D...");
    isSyncing = true;
    const syncMetadata = {
      version: "1.0.0",
      lastSync: (/* @__PURE__ */ new Date()).toISOString(),
      templateVersion: "0.2.9",
      files: {},
      jsonPaths: {
        managed: {},
        seed: {}
      }
    };
    const result = {
      success: 0,
      skipped: 0,
      errors: 0,
      conflicts: 0,
      files: []
    };
    for (const file of filesToSync) {
      try {
        const sourcePath = join7(templatePath, file);
        const targetPath = join7(targetDir, file);
        if (!existsSync7(sourcePath)) {
          warn(`\u30B9\u30AD\u30C3\u30D7: ${file} (\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u30D5\u30A1\u30A4\u30EB\u304C\u5B58\u5728\u3057\u307E\u305B\u3093)`);
          result.skipped++;
          result.files.push({
            path: file,
            action: "skipped",
            reason: "\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u30D5\u30A1\u30A4\u30EB\u304C\u5B58\u5728\u3057\u307E\u305B\u3093"
          });
          continue;
        }
        const mergeResult = await mergeAndWriteFile(
          sourcePath,
          targetPath,
          syncMetadata,
          packageJsonSections,
          conflictStrategy,
          templateVariables
        );
        const mappedAction = mergeResult.action === "created" || mergeResult.action === "overwritten" ? "copied" : mergeResult.action;
        result.success++;
        result.files.push({
          path: file,
          action: mappedAction
        });
        info(`  \u2713 ${file}`);
      } catch (error2) {
        result.errors++;
        result.files.push({
          path: file,
          action: "error",
          reason: error2 instanceof Error ? error2.message : "\u4E0D\u660E\u306A\u30A8\u30E9\u30FC"
        });
        error(`  \u2717 ${file}: ${error2}`);
      }
    }
    const syncedFiles = result.files.filter((f) => f.action === "copied" || f.action === "merged").map((f) => f.path);
    if (syncedFiles.length > 0) {
      const validation = await validatePlaceholders(targetDir, syncedFiles);
      if (!validation.isValid) {
        warn("\n\u26A0 \u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u5909\u6570\u306E\u7F6E\u63DB\u6F0F\u308C\u3092\u691C\u51FA:");
        for (const v of validation.violations) {
          warn(`  ${v.filePath}:${v.line} \u2014 ${v.placeholder}`);
        }
      }
    }
    info("\n\u{1F4CA} \u540C\u671F\u7D50\u679C:");
    info(`  \u6210\u529F: ${result.success}\u30D5\u30A1\u30A4\u30EB`);
    if (result.skipped > 0) {
      info(`  \u30B9\u30AD\u30C3\u30D7: ${result.skipped}\u30D5\u30A1\u30A4\u30EB`);
    }
    if (result.errors > 0) {
      error(`  \u30A8\u30E9\u30FC: ${result.errors}\u30D5\u30A1\u30A4\u30EB`);
    }
    if (result.errors > 0) {
      isSyncing = false;
      error("\n\u274C \u540C\u671F\u4E2D\u306B\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F");
      if (backupDir) {
        info("\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7\u304B\u3089\u5FA9\u5143: npx create-einja-app sync --rollback");
      }
      process.exit(1);
    }
    success("\n\u2713 \u540C\u671F\u5B8C\u4E86");
    isSyncing = false;
    currentBackupDir = void 0;
    if (backupDir) {
      info(`
\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7: ${backupDir}`);
      info("\u5FA9\u5143\u65B9\u6CD5: npx create-einja-app sync --rollback");
    }
  } finally {
    cleanup();
  }
}

// src/cli.ts
var __filename2 = fileURLToPath3(import.meta.url);
var __dirname2 = dirname6(__filename2);
var packageJsonPath = join8(__dirname2, "../package.json");
var packageJson = JSON.parse(readFileSync5(packageJsonPath, "utf-8"));
var program = new Command();
program.name("create-einja-app").description("CLI tool to create new projects with Einja Management Template").version(packageJson.version);
program.argument("[project-name]", "Project name").option("--skip-git", "Skip git initialization").option("--skip-install", "Skip package installation").action(
  async (projectName, options) => {
    await createCommand(projectName, options);
  }
);
program.command("sync").description("Sync template files to existing project").option("--categories <categories>", "Comma-separated list of categories to sync").option("--all", "Sync all categories").option("--dry-run", "Preview changes without making them").option("--backup", "Create backup before syncing (default: true)", true).option("--rollback", "Rollback to previous backup").option("--force", "Force sync even with uncommitted changes").action(
  async (options) => {
    await syncCommand({
      categories: options.categories?.split(","),
      all: options.all || false,
      dryRun: options.dryRun || false,
      backup: options.backup !== false,
      // デフォルトtrue
      rollback: options.rollback || false,
      force: options.force || false
    });
  }
);
program.parse();
//# sourceMappingURL=cli.js.map