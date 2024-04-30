import * as core from '@actions/core'
import * as github from '@actions/github'
import generateSummary, { GenerateSummaryReport } from './generate-summary'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    core.debug('Generating Robot report started')
    const inputs: Inputs = {
      token: core.getInput('gh_access_token'),
      report_path: core.getInput('report_path'),
      sha: core.getInput('sha'),
      pull_request_id: core.getInput('pull_request_id')
    }

    if (!inputs.report_path) {
      core.setFailed('report_path is required')
      return
    }

    if (!inputs.sha) {
      core.setFailed('sha is required')
      return
    }

    const owner = process.env.GITHUB_REPOSITORY?.split('/')[0]
    core.debug(`owner: ${owner}`)

    const reportSummary: GenerateSummaryReport = await generateSummary(
      inputs.report_path
    )

    core.info('Generating Robot report completed')

    core.info(`Total tests: ${reportSummary.total}`)
    core.info(`Passed: ${reportSummary.statistics.pass}`)
    core.info(`Failed: ${reportSummary.statistics.fail}`)
    core.info(`Skipped: ${reportSummary.statistics.skip}`)
    core.info(`Pass percentage: ${reportSummary.passPercentage}`)
    core.info(`Total execution time: ${reportSummary.totalExecutionTime}`)
    core.info('Failed tests:')
    reportSummary.failedTests.forEach(test => {
      core.info(`Test: ${test.name}`)
      core.info(`Execution time: ${test.execution_time}`)
      core.info(`Message: ${test.message}`)
    })

    await core.summary
      .addHeading('Robot Results Summary')
      .addTable([
        [
          { data: 'Passed ✅', header: true },
          { data: 'Failed ❌', header: true },
          { data: 'Skipped :rocket: ', header: true },
          { data: 'Total', header: true },
          { data: 'Pass%', header: true }
        ],
        [
          String(reportSummary.statistics.pass),
          String(reportSummary.statistics.fail),
          String(reportSummary.statistics.skip),
          String(
            reportSummary.statistics.pass +
              reportSummary.statistics.fail +
              reportSummary.statistics.skip
          ),
          (
            (reportSummary.statistics.pass /
              (reportSummary.statistics.pass +
                reportSummary.statistics.fail +
                reportSummary.statistics.skip)) *
            100
          ).toFixed(2)
        ]
      ])
      .addBreak()
      .addHeading('Failed Tests')
      .addTable([
        [
          { data: 'Test Name', header: true },
          { data: 'Message', header: true },
          { data: 'Suite Name', header: true },
          { data: 'Execution Time :clock1:', header: true }
        ],
        ...reportSummary.failedTests.map(test => [
          test.name,
          test.message,
          test.suite,
          `${test.execution_time.toFixed(2)} s`
        ])
      ])
      .write()

    // Comment on the PR with the summary as a comment
    if (inputs.pull_request_id && inputs.token) {
      const octokit = github.getOctokit(inputs.token)

      const summaryStatistics = reportSummary.statistics
      const summaryFailedTests = reportSummary.failedTests

      const comment =
        'Robot Framework Test Report\n\n' +
        'Robot Results Summary\n\n' +
        '| Passed | Failed | Skipped | Total | Pass% |\n' +
        '| --- | --- | --- | --- | --- |\n' +
        `| ${summaryStatistics.pass} | ${summaryStatistics.fail} | ${summaryStatistics.skip} | ${summaryStatistics.pass + summaryStatistics.fail + summaryStatistics.skip} | ${((summaryStatistics.pass / (summaryStatistics.pass + summaryStatistics.fail + summaryStatistics.skip)) * 100).toFixed(2)} |\n\n` +
        'Failed Tests\n\n' +
        '| Test Name | Message | Suite | Execution Time |\n' +
        '| --- | --- | --- |\n' +
        summaryFailedTests
          .map(
            test =>
              `| ${test.name} | ${test.message} | ${test.suite} | ${test.execution_time} |\n`
          )
          .join('')

      await octokit.rest.issues.createComment({
        owner: owner ?? 'Solibri',
        repo: process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'desktop-main', // Repository name
        issue_number: parseInt(inputs.pull_request_id),
        body: comment
      })
    }

    if (reportSummary.statistics.fail > 0) {
      core.setFailed(
        'Robot tests failed. Please check the summary for more details'
      )
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}

export interface Inputs {
  token: string
  report_path: string
  sha: string
  pull_request_id: string
}

export interface Test {
  name: string
  status: string
  suite: string
  execution_time: number
  message: string
}

export interface Statistics {
  pass: number
  fail: number
  skip: number
}
