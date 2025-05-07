#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs-extra';
import { Parser } from 'json2csv';
import path from 'path';
import { fileURLToPath } from 'url';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const program = new Command();

program
  .name('repo-analyzer')
  .description('GitHub Repository Analyzer: Fetch stats and analyze GitHub repositories')
  .version('1.0.0');

program
  .command('analyze')
  .description('Analyze a GitHub repository')
  .option('-r, --repo <repo>', 'GitHub repository in format owner/repo')
  .option('-t, --token <token>', 'GitHub personal access token')
  .option('-c, --csv', 'Export results to CSV')
  .option('-g, --graph', 'Generate graphs')
  .option('-o, --output <directory>', 'Output directory for exports', './output')
  .action(async (options) => {
    try {
      await analyzeRepo(options);
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('configure')
  .description('Configure GitHub token')
  .action(async () => {
    try {
      await configureToken();
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program.parse();

if (process.argv.length <= 2) {
  showInteractiveMode();
}

async function showInteractiveMode() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'repo',
      message: 'Enter GitHub repository (owner/repo):',
      validate: (input) => {
        if (input.includes('/')) return true;
        return 'Please enter the repository in format owner/repo';
      }
    },
    {
      type: 'confirm', 
      name: 'useToken',
      message: 'Do you want to use a GitHub token? (increases rate limits)',
      default: false
    },
    {
      type: 'password',
      name: 'token',
      message: 'Enter your GitHub token:',
      when: (answers) => answers.useToken
    },
    {
      type: 'confirm',
      name: 'exportCsv',
      message: 'Export results to CSV?',
      default: false
    },
    {
      type: 'confirm',
      name: 'generateGraph',
      message: 'Generate graphs (requires Node Canvas)?',
      default: false
    },
    {
      type: 'input',
      name: 'outputDir',
      message: 'Output directory for exports:',
      default: './output',
      when: (answers) => answers.exportCsv || answers.generateGraph
    }
  ]);

  const options = {
    repo: answers.repo,
    token: answers.token,
    csv: answers.exportCsv,
    graph: answers.generateGraph,
    output: answers.outputDir
  };

  await analyzeRepo(options);
}

async function configureToken() {
  const answers = await inquirer.prompt([
    {
      type: 'password',
      name: 'token',
      message: 'Enter your GitHub personal access token:'
    }
  ]);

  await fs.writeFile('.env', `GITHUB_TOKEN=${answers.token}`);
  console.log(chalk.green('✓ Token saved to .env file'));
}

async function analyzeRepo(options) {
  const repo = options.repo;
  let token = options.token || process.env.GITHUB_TOKEN;

  if (!repo) {
    throw new Error('Repository not specified. Use -r owner/repo or run in interactive mode');
  }

  const [owner, repoName] = repo.split('/');
  
  if (!owner || !repoName) {
    throw new Error('Invalid repository format. Please use owner/repo');
  }

  const headers = token 
    ? { Authorization: `token ${token}` }
    : {};

  console.log(chalk.blue.bold('\n🔍 GitHub Repository Analyzer'));
  console.log(chalk.blue(`Analyzing repository: ${chalk.cyan(repo)}\n`));

  if (options.csv || options.graph) {
    await fs.ensureDir(options.output);
  }

  const githubApi = axios.create({
    baseURL: 'https://api.github.com',
    headers
  });

  const spinner = ora('Fetching repository information...').start();
  
  try {
    const repoData = await githubApi.get(`/repos/${owner}/${repoName}`);
    spinner.succeed('Repository information fetched');

    console.log(chalk.green.bold('\n📊 Repository Statistics'));
    
    const statsTable = new Table({
      head: [chalk.white('Metric'), chalk.white('Value')],
      colWidths: [25, 50]
    });

    statsTable.push(
      ['Name', repoData.data.full_name],
      ['Description', repoData.data.description || 'N/A'],
      ['Stars', repoData.data.stargazers_count],
      ['Forks', repoData.data.forks_count],
      ['Watchers', repoData.data.subscribers_count],
      ['Open Issues', repoData.data.open_issues_count],
      ['Default Branch', repoData.data.default_branch],
      ['Created At', new Date(repoData.data.created_at).toLocaleDateString()],
      ['Updated At', new Date(repoData.data.updated_at).toLocaleDateString()]
    );

    console.log(statsTable.toString());

    spinner.text = 'Fetching contributors...';
    spinner.start();
    const contributorsData = await githubApi.get(`/repos/${owner}/${repoName}/contributors?per_page=100`);
    spinner.succeed('Contributors fetched');

    console.log(chalk.green.bold('\n👥 Top Contributors'));
    
    const contributorsTable = new Table({
      head: [
        chalk.white('Rank'), 
        chalk.white('Username'), 
        chalk.white('Contributions')
      ],
      colWidths: [10, 30, 20]
    });

    const contributors = contributorsData.data
      .sort((a, b) => b.contributions - a.contributions)
      .slice(0, 10);
      
    contributors.forEach((contributor, index) => {
      contributorsTable.push([
        index + 1,
        contributor.login,
        contributor.contributions
      ]);
    });

    console.log(contributorsTable.toString());

    spinner.text = 'Analyzing repository content...';
    spinner.start();

    const commitsData = await githubApi.get(`/repos/${owner}/${repoName}/commits?per_page=100`);
    const defaultBranch = repoData.data.default_branch;
    
    const branchData = await githubApi.get(`/repos/${owner}/${repoName}/branches/${defaultBranch}`);
    const treeUrl = `${branchData.data.commit.commit.tree.url}?recursive=1`;
    const treeData = await githubApi.get(treeUrl);
    
    const fileChanges = {};
    
    for (const commit of commitsData.data.slice(0, 30)) {
      try {
        const commitData = await githubApi.get(`/repos/${owner}/${repoName}/commits/${commit.sha}`);
        
        for (const file of commitData.data.files || []) {
          const filename = file.filename;
          if (!fileChanges[filename]) {
            fileChanges[filename] = {
              changes: 0,
              additions: 0,
              deletions: 0
            };
          }
          
          fileChanges[filename].changes += file.changes;
          fileChanges[filename].additions += file.additions;
          fileChanges[filename].deletions += file.deletions;
        }
      } catch (error) {
        console.error(`Error analyzing commit ${commit.sha}: ${error.message}`);
      }
    }
    
    spinner.succeed('Repository content analyzed');

    console.log(chalk.green.bold('\n📄 Most Changed Files'));
    
    const filesTable = new Table({
      head: [
        chalk.white('Rank'), 
        chalk.white('Filename'), 
        chalk.white('Changes'), 
        chalk.white('Additions'), 
        chalk.white('Deletions')
      ],
      colWidths: [10, 35, 15, 15, 15]
    });

    const sortedFiles = Object.entries(fileChanges)
      .sort((a, b) => b[1].changes - a[1].changes)
      .slice(0, 10);
      
    sortedFiles.forEach(([filename, stats], index) => {
      filesTable.push([
        index + 1,
        filename.length > 33 ? '...' + filename.slice(-30) : filename,
        stats.changes,
        stats.additions,
        stats.deletions
      ]);
    });

    console.log(filesTable.toString());

    if (options.csv) {
      await exportToCsv({
        repo: repoData.data,
        contributors,
        files: sortedFiles
      }, options.output);
    }

    if (options.graph) {
      await generateGraphs({
        contributors,
        files: sortedFiles
      }, options.output);
    }

    console.log(chalk.blue.bold('\n✅ Analysis completed successfully!'));

  } catch (error) {
    spinner.fail(`Failed to analyze repository: ${error.message}`);
    
    if (error.response && error.response.status === 403) {
      console.error(chalk.red('API rate limit exceeded. Try using a GitHub token with the -t option.'));
    } else if (error.response && error.response.status === 404) {
      console.error(chalk.red('Repository not found. Check the repository name.'));
    } else {
      console.error(chalk.red(`Error: ${error.message}`));
    }
    
    process.exit(1);
  }
}

async function exportToCsv(data, outputDir) {
  const spinner = ora('Exporting data to CSV...').start();
  
  try {
    const repoFields = [
      'full_name', 'description', 'stargazers_count', 'forks_count', 
      'subscribers_count', 'open_issues_count', 'default_branch',
      'created_at', 'updated_at'
    ];
    
    const repoParser = new Parser({ fields: repoFields });
    const repoCsv = repoParser.parse(data.repo);
    await fs.writeFile(path.join(outputDir, 'repo_stats.csv'), repoCsv);

    const contributorsParser = new Parser({
      fields: ['login', 'contributions'],
      header: true
    });
    const contributorsCsv = contributorsParser.parse(data.contributors);
    await fs.writeFile(path.join(outputDir, 'contributors.csv'), contributorsCsv);

    const filesData = data.files.map(([filename, stats]) => ({
      filename,
      changes: stats.changes,
      additions: stats.additions,
      deletions: stats.deletions
    }));
    
    const filesParser = new Parser({
      fields: ['filename', 'changes', 'additions', 'deletions'],
      header: true
    });
    
    const filesCsv = filesParser.parse(filesData);
    await fs.writeFile(path.join(outputDir, 'files.csv'), filesCsv);

    spinner.succeed(`Data exported to CSV files in ${outputDir}`);
  } catch (error) {
    spinner.fail(`Failed to export data: ${error.message}`);
  }
}

async function generateGraphs(data, outputDir) {
  const spinner = ora('Generating graphs...').start();
  
  try {
    const width = 800;
    const height = 600;
    const chartJSNodeCanvas = new ChartJSNodeCanvas({ 
      width, 
      height,
      backgroundColour: 'white'
    });

    const contributorsLabels = data.contributors.map(c => c.login);
    const contributorsValues = data.contributors.map(c => c.contributions);
    
    const contributorsConfig = {
      type: 'bar',
      data: {
        labels: contributorsLabels,
        datasets: [{
          label: 'Contributions',
          data: contributorsValues,
          backgroundColor: 'rgba(54, 162, 235, 0.8)'
        }]
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Number of Contributions'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Contributors'
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Top Contributors'
          },
          legend: {
            display: false
          }
        }
      }
    };
    
    const contributorsImage = await chartJSNodeCanvas.renderToBuffer(contributorsConfig);
    await fs.writeFile(path.join(outputDir, 'contributors_chart.png'), contributorsImage);

    const filesLabels = data.files.map(([filename]) => {
      const parts = filename.split('/');
      return parts[parts.length - 1];
    });
    
    const filesChanges = data.files.map(([_, stats]) => stats.changes);
    const filesAdditions = data.files.map(([_, stats]) => stats.additions);
    const filesDeletions = data.files.map(([_, stats]) => stats.deletions);
    
    const filesConfig = {
      type: 'bar',
      data: {
        labels: filesLabels,
        datasets: [
          {
            label: 'Changes',
            data: filesChanges,
            backgroundColor: 'rgba(54, 162, 235, 0.6)'
          },
          {
            label: 'Additions',
            data: filesAdditions,
            backgroundColor: 'rgba(75, 192, 192, 0.6)'
          },
          {
            label: 'Deletions',
            data: filesDeletions,
            backgroundColor: 'rgba(255, 99, 132, 0.6)'
          }
        ]
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Count'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Files'
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Most Changed Files'
          }
        }
      }
    };
    
    const filesImage = await chartJSNodeCanvas.renderToBuffer(filesConfig);
    await fs.writeFile(path.join(outputDir, 'files_chart.png'), filesImage);

    spinner.succeed(`Graphs saved to ${outputDir}`);
  } catch (error) {
    spinner.fail(`Failed to generate graphs: ${error.message}`);
    console.error(chalk.yellow('Make sure you have Cairo graphics installed for Chart.js Canvas rendering'));
  }
}
