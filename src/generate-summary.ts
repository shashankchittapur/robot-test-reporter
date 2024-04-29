import * as core from '@actions/core'
import {  Statistics, Test } from './main'


const XmlReader = require('xml-reader');

export interface GenerateSummaryReport {
  failedTests: Test[]
  passedTests: Test[]
  statistics: Statistics
  total: number
  passPercentage: number
  totalExecutionTime: number
}


export default async function generateSummary(reportPath: string): Promise<GenerateSummaryReport> {
    try {
      core.debug('Generating Robot report started')
      const fs = require('fs')
      const path = require('path')
      const outputFile = path.join(reportPath, 'output.xml')
      if (!fs.existsSync(outputFile)) {
        throw new Error('output.xml file not found in the report path')
      }
      console.log('Reading output.xml file started')
      const outputFileDate = fs.readFileSync(outputFile, 'utf8')
      console.log('Reading output.xml file completed')
      
      const xmlReader = XmlReader.create({stream:true})

      const failedTests: Test[] = []
      const passedTests: Test[] = []
      let totalExecutionTime = 0

      xmlReader.on('tag:test', (test:any) => {
        const statusNode = test.children.find((child: any) => child.name === 'status')
        const statusAttributes = statusNode.attributes
        const endDateTime = convertToDate(statusAttributes.endtime);
        const endTime = endDateTime.getTime();
        const startDateTime = convertToDate(statusAttributes.starttime);
        const startTime = startDateTime.getTime();
        const testExecutionTime = (endTime - startTime) / 1000
        const testName = test.attributes.name
        const message = statusNode.children.filter((child: any) => child.type === 'text').map((child: any) => child.value).join('')
        const testStatus = statusAttributes.status
        const suiteName = test.parent.attributes.name

        if (testStatus === 'PASS') {
          passedTests.push({
            name: testName,
            status: testStatus,
            execution_time: testExecutionTime,
            message: message,
            suite: suiteName
          })
        } else if (testStatus === 'FAIL') {
          failedTests.push({
            name: testName,
            status: testStatus,
            execution_time: testExecutionTime,
            message: message,
            suite: suiteName
          })
        }
        totalExecutionTime += testExecutionTime
      })

      let totalPass = 0
      let totalFail = 0
      let totalSkip = 0
      xmlReader.on('tag:statistics', (statistics:any) => {
        const stat = statistics.children.find((child: any) => child.name === 'total')
                                   .children.find((child: any) => child.name === 'stat')
        totalPass = parseInt(stat.attributes.pass)
        totalFail = parseInt(stat.attributes.fail)
        totalSkip = parseInt(stat.attributes.skip)
      })
      xmlReader.parse(outputFileDate)

      const statistics: Statistics = {
        pass: totalPass,
        fail: totalFail,
        skip: totalSkip
      }

        const total = statistics.pass + statistics.fail

        const passPercentage = parseFloat(getPassPercentage(statistics.pass, statistics.fail))

        return {
          failedTests: failedTests,
          passedTests: passedTests,
          statistics: statistics,
          total: total,
          passPercentage: passPercentage,
          totalExecutionTime: totalExecutionTime
        }
      
    } catch (error) {
      // Fail the workflow run if an error occurs
      if (error instanceof Error) core.setFailed(error.message)
      return {
          failedTests: [],
          passedTests: [],
          statistics: {
              pass: 0,
              fail: 0,
              skip: 0
          },
          total: 0,
          passPercentage:0 ,
          totalExecutionTime: 0
      }
    }
}

function getPassPercentage( pass:number,  fail:number) {
  if (pass !==0 && fail === 0)
      return (100).toFixed(2)
  else if (pass !== 0 && fail !== 0)
    // return percentage with 2 decimal places
    return ((pass / (pass + fail)) * 100).toFixed(2)
  return ((pass / (pass + fail)) * 100).toFixed(2)
}
function convertToDate(dateTime: string) {
  const splitDateTime = dateTime.split(' ')
  const justDate = splitDateTime[0]
  const year = justDate.substring(0, 4)
  const month = justDate.substring(4, 6)
  const day = justDate.substring(6, 8)
  const time = splitDateTime[1]
  const dateWithISOFormat = `${year}-${month}-${day}T${time}`
  return new Date(dateWithISOFormat)
}

