#!/usr/bin/env tsx

import * as Effect from 'effect/Effect';
import * as Console from 'effect/Console';
import * as Match from 'effect/Match';
import * as FileSystem from '@effect/platform/FileSystem';
import * as Command from '@effect/platform/Command';
import * as CommandExecutor from '@effect/platform/CommandExecutor';
import { NodeContext, NodeRuntime } from '@effect/platform-node';
import { pipe } from 'effect/Function';

// Version type
type VersionType = 'major' | 'minor' | 'patch';

// Options
interface PublishOptions {
  versionType: VersionType;
  dryRun: boolean;
}

// Package.json interface
interface PackageJson {
  name: string;
  version: string;
  [key: string]: unknown;
}

// Parse version string to components
const parseVersion = (version: string): readonly [number, number, number] => {
  const parts = version.split('.').map(Number);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0] as const;
};

// Increment version based on type using pattern matching
const incrementVersion = (
  version: string,
  type: VersionType
): Effect.Effect<string, never, never> => {
  const [major, minor, patch] = parseVersion(version);

  return pipe(
    Match.value(type),
    Match.when('major', () => `${major + 1}.0.0`),
    Match.when('minor', () => `${major}.${minor + 1}.0`),
    Match.when('patch', () => `${major}.${minor}.${patch + 1}`),
    Match.exhaustive,
    Effect.succeed
  );
};

// Read package.json
const readPackageJson = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const content = yield* fs.readFileString('package.json');
  const pkg = JSON.parse(content) as PackageJson;
  return pkg;
});

// Write package.json
const writePackageJson = (pkg: PackageJson) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const content = JSON.stringify(pkg, null, 2) + '\n';
    yield* fs.writeFileString('package.json', content);
  });

// Execute git commands
const gitCommit = (version: string) =>
  Effect.gen(function* () {
    const executor = yield* CommandExecutor.CommandExecutor;

    // git add package.json
    const addCommand = Command.make('git', 'add', 'package.json');
    const addResult = yield* executor.start(addCommand);
    yield* addResult.exitCode;

    // git commit
    const commitCommand = Command.make('git', 'commit', '-m', `chore: bump version to ${version}`);
    const commitResult = yield* executor.start(commitCommand);
    yield* commitResult.exitCode;

    // git tag
    const tagCommand = Command.make('git', 'tag', `v${version}`);
    const tagResult = yield* executor.start(tagCommand);
    yield* tagResult.exitCode;
  });

// Execute npm publish
const npmPublish = (dryRun: boolean) =>
  Effect.gen(function* () {
    const executor = yield* CommandExecutor.CommandExecutor;
    const args = dryRun ? ['publish', '--dry-run'] : ['publish'];
    const command = Command.make('npm', ...args);
    const result = yield* executor.start(command);
    yield* result.exitCode;
  });

// Main publish pipeline
const publishPipeline = (options: PublishOptions) =>
  Effect.gen(function* () {
    const { versionType, dryRun } = options;

    // Read current package.json
    yield* Console.log(`📦 Reading package.json...`);
    const pkg = yield* readPackageJson;
    const oldVersion = pkg.version;

    // Increment version
    yield* Console.log(`🔢 Current version: ${oldVersion}`);
    const newVersion = yield* incrementVersion(oldVersion, versionType);
    yield* Console.log(`✨ New version: ${newVersion}`);

    if (dryRun) {
      yield* Console.log(`🏃 DRY RUN MODE - No changes will be made`);
      yield* Console.log(`Would update package.json to ${newVersion}`);
      yield* Console.log(`Would commit and tag with v${newVersion}`);
      yield* Console.log(`Would publish ${pkg.name}@${newVersion}`);
      return newVersion;
    }

    // Update package.json
    yield* Console.log(`💾 Updating package.json...`);
    const updatedPkg = { ...pkg, version: newVersion };
    yield* writePackageJson(updatedPkg);

    // Git commit and tag
    yield* Console.log(`📝 Creating git commit and tag...`);
    yield* gitCommit(newVersion);

    // Run npm publish
    yield* Console.log(`🚀 Publishing to npm...`);
    yield* npmPublish(false);

    yield* Console.log(`✅ Successfully published ${pkg.name}@${newVersion}`);
    yield* Console.log(`📌 Tagged as v${newVersion}`);
    yield* Console.log(`\n💡 Don't forget to run: git push && git push --tags`);
    return newVersion;
  }).pipe(Effect.scoped);

// Parse command line arguments
const parseOptions = (): Effect.Effect<PublishOptions, string, never> => {
  const versionArg = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');

  const versionType = pipe(
    Match.value(versionArg),
    Match.when('major', () => Effect.succeed('major' as const)),
    Match.when('minor', () => Effect.succeed('minor' as const)),
    Match.when('patch', () => Effect.succeed('patch' as const)),
    Match.orElse(() =>
      Effect.fail(
        'Invalid version type. Usage: tsx scripts/publish.ts [major|minor|patch] [--dry-run]'
      )
    )
  );

  return Effect.map(versionType, (type) => ({ versionType: type, dryRun }));
};

// Main program
const program = Effect.gen(function* () {
  const options = yield* parseOptions();
  const mode = options.dryRun ? '(DRY RUN)' : '';
  yield* Console.log(`\n🎯 Publishing ${options.versionType} version ${mode}...\n`);
  const newVersion = yield* publishPipeline(options);
  return newVersion;
});

// Run the program
program.pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain);
