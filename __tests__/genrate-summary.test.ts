import { expect } from '@jest/globals'
import generateSummary from '../src/generate-summary'

describe('generate-summary.ts',() => {
 
    it('validate summary report',async () => {
    
        const reportPath = '__tests__/resources'
        const summary = await generateSummary(reportPath)
        console.log(`summary: ${JSON.stringify(summary)}`)
        expect(summary.failedTests.length).toBe(5)
        expect(summary.passedTests.length).toBe(52)
        expect(summary.statistics.pass).toBe(52)
        expect(summary.statistics.fail).toBe(5)
        expect(summary.statistics.skip).toBe(0)
        expect(summary.total).toBe(57)
        expect(summary.passPercentage).toBe(100)

        // Get sum of execution time for all passed tests
        let totalExecutionTimePassed = 0
        summary.passedTests.forEach(test => {
            totalExecutionTimePassed += test.execution_time
        })

        // Get sum of execution time for all failed tests
        let totalExecutionTimeFailed = 0
        summary.failedTests.forEach(test => {
            totalExecutionTimeFailed += test.execution_time
        })
        expect(summary.totalExecutionTime).toBe(totalExecutionTimePassed + totalExecutionTimeFailed)
    })
})