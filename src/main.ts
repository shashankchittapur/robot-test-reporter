import * as core from '@actions/core'
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
      pull_request_id: core.getInput('pull_request_id'),
    }

    if(!inputs.report_path) {
      core.setFailed('report_path is required')
      return
    }

    if(!inputs.sha) {
      core.setFailed('sha is required')
      return
    }

    const owner = process.env.GITHUB_REPOSITORY?.split('/')[0]
    core.debug(`owner: ${owner}`)

    const summary: GenerateSummaryReport  = await generateSummary(inputs.report_path)

    await core.summary
                .addHeading("Robot Framework Test Report")
                .addBreak()
                .addHeading("Robot Results Summary")
                .addTable([
                  [{data:'Passed', header:true}, {data:'Failed', header:true}, {data:'Skipped', header:true},{data:'Total', header:true},{data:'Pass%', header:true}],
                  [String(summary.statistics.pass), String(summary.statistics.fail), String(summary.statistics.skip), String(summary.statistics.pass + summary.statistics.fail + summary.statistics.skip), (summary.statistics.pass/(summary.statistics.pass + summary.statistics.fail + summary.statistics.skip)*100).toFixed(2)]
                ])
                .addBreak()
                .addHeading("Failed Tests")
                .addTable([
                  [{data:'Test Name', header:true}, {data:'Execution Time', header:true}, {data:'Message', header:true}],
                  ...summary.failedTests.map(test => [test.name, String(test.execution_time), test.message])
                ])
                .write();

      // Comment on the PR with the summary as a comment
      if(inputs.pull_request_id && inputs.token) {
        const octokit = require('@octokit/rest')({
          auth: inputs.token
        })

        const comment = `Robot Framework Test Report\n\nRobot Results Summary\n\n| Passed | Failed | Skipped | Total | Pass% |\n| --- | --- | --- | --- | --- |\n| ${summary.statistics.pass} | ${summary.statistics.fail} | ${summary.statistics.skip} | ${summary.statistics.pass + summary.statistics.fail + summary.statistics.skip} | ${(summary.statistics.pass/(summary.statistics.pass + summary.statistics.fail + summary.statistics.skip)*100).toFixed(2)} |\n\nFailed Tests\n\n| Test Name | Execution Time | Message |\n| --- | --- | --- |\n${summary.failedTests.map(test => `| ${test.name} | ${test.execution_time} | ${test.message} |\n`).join('')}`

        await octokit.issues.createComment({
          owner,
          repo: process.env.GITHUB_REPOSITORY?.split('/')[1],
          issue_number: parseInt(inputs.pull_request_id),
          body: comment
        })
      }


  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}

export interface Inputs {
  token: string
  report_path:string
  sha:string
  pull_request_id:string
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
