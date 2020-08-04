/* eslint-disable unicorn/no-process-exit,@typescript-eslint/restrict-template-expressions,@typescript-eslint/no-floating-promises */
import fs from 'fs-extra'
import neodoc from 'neodoc'
import { DEFAULT_SEVERITY_DISTRIBUTION } from '../constants'

import { run } from '../algorithms/run'

import {
  ScenarioFlat,
  ScenarioData,
  SeverityDistributionData,
  SeverityDistributionDatum,
  SeverityDistributionArray,
  AgeDistributionData,
  AgeDistributionDatum,
  AgeDistributionArray,
  Convert,
} from '../algorithms/types/Param.types'

import { toInternal } from '../algorithms/types/convert'

const handleRejection: NodeJS.UnhandledRejectionListener = (err) => {
  console.error(err)
  process.exit(1)
}

process.on('unhandledRejection', handleRejection)

/**
 * Run the model //TODO: these docs
 *
 * @param params: ScenarioFlat  it's got some properties to it
 * @param severity              Severity array
 * @param ageDistribution       Age distribution array
 */
export async function runModel(
  params: ScenarioFlat,
  severity: SeverityDistributionDatum[],
  ageDistribution: AgeDistributionDatum[],
) {
  return run({ params, severity, ageDistribution })
}

/**
 * Read a file in JSON format.
 *
 * @param inputFilename The path to the file.
 */
function readJsonFromFile<T>(inputFilename: string) {
  console.info(`Reading data from file ${inputFilename}`)
  return fs.readJsonSync(inputFilename, { encoding: 'utf8' }) as T
}

/**
 * Get severity distribution data. If a file is specified on the command
 * line, give priority to its contents, else load a default distribution.
 *
 * @param inputFilename The path to the file.
 */
function getSeverity(inputFilename: string | undefined): SeverityDistributionDatum[] {
  if (inputFilename) {
    const data: SeverityDistributionData = readJsonFromFile<SeverityDistributionData>(inputFilename)
    return data.data
  }

  const dataRaw: SeverityDistributionData = readJsonFromFile<SeverityDistributionData>(
    './src/assets/data/severityDistributions.json',
  )
  const severityDistributionFound:
    | SeverityDistributionData
    | undefined = ((dataRaw as unknown) as SeverityDistributionArray).all.find(
    (s) => s.name === DEFAULT_SEVERITY_DISTRIBUTION,
  )
  if (!severityDistributionFound) {
    throw new Error(`Error: scenario not found`)
  }

  const severityDistribution = Convert.toSeverityDistributionData(JSON.stringify(severityDistributionFound))

  severityDistribution.data.sort((a, b) => {
    if (a.ageGroup > b.ageGroup) {
      return +1
    }

    if (a.ageGroup < b.ageGroup) {
      return -1
    }

    return 0
  })

  return severityDistribution.data
}

/**
 * Get age distribution data. If a file is specified on the command
 * line, give priority to its contents, else load the distribution
 * name as specified in the scenario parameters.
 *
 * @param inputFilename The path to the file.
 * @param name The age distribution name to use if no file is
 *             specified.
 */
function getAge(inputFilename: string | undefined, name: string): AgeDistributionDatum[] {
  if (inputFilename) {
    const data = readJsonFromFile<AgeDistributionData>(inputFilename)
    return data.data
  }
  const dataRaw: AgeDistributionData = readJsonFromFile<AgeDistributionData>('./src/assets/data/ageDistribution.json')
  const ageDistributionFound: AgeDistributionData | undefined = ((dataRaw as unknown) as AgeDistributionArray).all.find(
    (cad) => cad.name === name,
  )
  if (!ageDistributionFound) {
    throw new Error(`Error: country age distribution "${name}" not found in JSON`)
  }

  const ageDistribution = Convert.toAgeDistributionData(JSON.stringify(ageDistributionFound))

  // eslint-disable-next-line sonarjs/no-identical-functions
  ageDistribution.data.sort((a, b) => {
    if (a.ageGroup > b.ageGroup) {
      return +1
    }

    if (a.ageGroup < b.ageGroup) {
      return -1
    }

    return 0
  })

  return ageDistribution.data
}

async function main() {
  // Command line argument processing.
  const argv = neodoc.run(
    `
    usage: cli <scenario> <output> [options]

    options:
      <scenario>            Path to scenario parameters JSON file
      <output>              Path to output file

      --age=<pathToAgeDistribution>
                            Path to age distribution JSON file
      --ageDistribution=<ageDistribution>
                            Name of country for age distribution
      --severity=<pathToSeverityDistribution>
                            Path to severity JSON file
      --hospitalStayDays=<hospitalStayDays>
                            Average number of days a severe case stays in regular hospital beds
      --icuStayDays=<icuStayDays>
                            Average number of days a critical case stays in the Intensive Care Unit (ICU)
      --infectiousPeriodDays=<infectiousPeriodDays>
                            Average number of days a person is infectious
      --latencyDays=<latencyDays>
                            Time from infection to onset of symptoms (here onset of infectiousness)
      --overflowSeverity=<overflowSeverity>
                            A multiplicative factor to death rate to patients that require but do not have access to an Intensive Care Unit (ICU) bed relative to those who do
      --peakMonth=<peakMonth>
                            Time of the year with peak transmission (month as a number)
      --r0Low=<r0Low>
                            Average number of secondary infections per case (lower bound)
      --r0High=<r0High>
                            Average number of secondary infections per case (upper bound)
      --ageDistributionName=<ageDistributionName>
                            Name of age distribution data to use
      --caseCountsName=<caseCountsName>
                            Name of case count data to use
      --hospitalBeds=<hospitalBeds>
                            Number of hospital beds available
      --icuBeds=<icuBeds>
                            Number of available beds in Intensive Care Units (ICUs)
      --importsPerDay=<importsPerDay>
                            Number of cases imported from the outside per day on average
      --initialNumberOfCases=<initialNumberOfCases>
                            Number of cases present at the start of simulation
      --populationServed=<populationServed>
                            Number of people served by the healthcare system
      --numberStochasticRuns=<numberStochasticRuns>
                            Number of runs, to account for the uncertainty of parameters.
      --mitTimeRangeBegin=<mitTimeRangeBegin>
                            Start of mitigation time period (date in form yyyy-mm-dd)
      --mitTimeRangeEnd=<mitTimeRangeEnd>
                            End of mitigation time period (date in form yyyy-mm-dd)
      --transmissionReductionLow=<transmissionReductionLow>
                            Intervention efficacy as a range of plausible multiplicative reductions of the base growth rate (low bound)
      --transmissionReductionHigh=<transmissionReductionHigh>
                            Intervention efficacy as a range of plausible multiplicative reductions of the base growth rate (high bound)
      --simulationRangeBegin=<simulationRangeBegin>
                            Beginning of simulation time range (date in form yyyy-mm-dd)
      --simulationRangeEnd=<simulationRangeEnd>
                            End of simulation time range (date in form yyyy-mm-dd)
      --name=<name>
                            Scenario name
      --color=<color>
                            Colorhex
    `,
    { smartOptions: true },
  )

  // Read the scenario data.
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const scenarioData: ScenarioData = readJsonFromFile<ScenarioData>(argv['<scenario>']!)
  const scenario = toInternal(scenarioData.data)
  const params: ScenarioFlat = {
    ...scenario.population,
    ...scenario.epidemiological,
    ...scenario.simulation,
    ...scenario.mitigation,
  }

  const ageDistributionName: string = argv['--ageDistribution'] ? argv['--ageDistribution'] : params.ageDistributionName

  // Load severity and age data.
  const severity = getSeverity(argv['--severity'])
  const ageDistribution = getAge(argv['--age'], ageDistributionName)


  Object.keys(scenario.epidemiological).forEach((key) => {
    if (argv[`--${key}`]) {
      scenario.epidemiological[key] = argv[`--${key}`]
    }
  })
  if (argv['--r0Low']) {
    scenario.epidemiological.r0.begin = argv['--r0Low']
  }
  if (argv['--r0High']) {
    scenario.epidemiological.r0.end = argv['--r0High']
  }

  Object.keys(scenario.population).forEach((key) => {
    if (argv[`--${key}`]) {
      scenario.population[key] = argv[`--${key}`]
    }
  })
  if (argv['--numberStochasticRuns']) {
    scenario.simulation.numberStochasticRuns = argv['--numberStochasticRuns']
  }
  if (argv['--mitTimeRangeBegin']) {
    scenario.mitigation.mitigationIntervals[0].timeRange.begin = argv['--mitTimeRangeBegin']
  }
  if (argv['--mitTimeRangeEnd']) {
    scenario.mitigation.mitigationIntervals[0].timeRange.end = argv['--mitTimeRangeEnd']
  }
  if (argv['--transmissionReductionLow']) {
    scenario.mitigation.mitigationIntervals[0].transmissionReduction.begin = argv['--transmissionReductionLow']
  }
  if (argv['--transmissionReductionHigh']) {
    scenario.mitigation.mitigationIntervals[0].transmissionReduction.end = argv['--transmissionReductionHigh']
  }
  if (argv['--simulationRangeBegin']) {
    scenario.simulation.simulationTimeRange.begin = argv['--simulationRangeBegin']
  }
  if (argv['--transmissionReductionEnd']) {
    scenario.simulation.simulationTimeRange.end = argv['--simulationRangeEnd']
  }
  if (argv['--name']) {
    scenario.name = argv['--name']
  }
  // Run the model.
  try {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const outputFile: string = argv['<output>']!
    console.info('Running the model')
    const result = await runModel(params, severity, ageDistribution)
    console.info('Run complete')
    console.info(`Writing output to ${outputFile}`)
    fs.writeFileSync('scenariofile.json',JSON.stringify(scenario))
    fs.writeFileSync(outputFile, JSON.stringify(result))
  } catch (error) {
    console.error(`Run failed: ${error}`)
    process.exit(1)
  }
}

main()
