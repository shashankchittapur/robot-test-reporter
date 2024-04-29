import * as core from '@actions/core'
import {  Statistics, Test } from './main'


const xmlQuery = require('xml-query');
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

      const output = await readOutput(reportPath)
      
      const xq = xmlQuery(output)

      // declare failed tests and passed tests arrays
      const failedTests: Test[] = []
      const passedTests: Test[] = []
      let totalExecutionTime = 0



     xq.find('test').each((test:any) => {
      const statusAttributes = test.children.find((child: any) => child.name === 'status').attributes;
      const status = statusAttributes.status
      const name = test.attributes.name
      const suite = test.parent.attributes.name
      const endTime:Date = convertToDate(statusAttributes.endtime)
      const startTime:Date = convertToDate(statusAttributes.starttime)
      
      const executionTime = (endTime.getTime() - startTime.getTime()) / 1000
      
      const message = statusAttributes.message
      const test1: Test = {
          name: name,
          status: status,
          suite: suite,
          execution_time: executionTime,
          message: message
      }

      if (status === 'PASS') {
          passedTests.push(test1)
      } else if (status === 'FAIL') {
          failedTests.push(test1)
      } 
      totalExecutionTime += executionTime
    })
    
      

      const statisticsPath = xq.find('statistics').children().find('total').children().find('stat')
      
      const statistics: Statistics = {
          pass: parseInt(statisticsPath.attr('pass')),
          fail: parseInt(statisticsPath.attr('fail')),
          skip: parseInt(statisticsPath.attr('skip'))
      }

      const total = statistics.pass + statistics.fail

      const passPercentage = getPassPercentage(statistics.pass, statistics.fail)

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

async function readOutput(reportPath: string) {
  const fs = require('fs')
  const path = require('path')
  const outputFile = path.join(reportPath, 'output.xml')
  if (!fs.existsSync(outputFile)) {
    throw new Error('output.xml file not found in the report path')
  }
  return XmlReader.parseSync(fs.readFileSync(outputFile, 'utf8'))
}

function getPassPercentage( pass:number,  fail:number) {
  if (pass !==0 && fail === 0)
      return 100
  else if (pass !== 0 && fail !== 0)
    return (pass / (pass + fail)) * 100
  return (pass / (pass + fail)) * 100
}
function convertToDate(dateTime: string) {
  const splitDateTime = dateTime.split(' ')
  const date = splitDateTime[0]
  const time = splitDateTime[1]
  return new Date(`${date}T${time}`)
}

