const axios = require('axios');
const cheerio = require('cheerio');
const { Parser } = require('json2csv');
const fs = require('fs');

const urlPageOne = 'https://www.bdh-online.de/patienten/therapeutensuche/?seite=1';
const urlPageTwo = 'https://www.bdh-online.de/patienten/therapeutensuche/?seite=2';

async function fetchHTML(url) {
    try {
        const { data } = await axios.get(url);
        return data;
    } catch (error) {
        throw new Error(`Error fetching HTML from ${url}: ${error}`);
    }
}

async function fetchDetails(url) {
    try {
        const html = await fetchHTML(url);
        const $ = cheerio.load(html);
        const name = $('.col-md-8 b').first().text().trim();
        const email = $('.col-md-8 a[href^="mailto:"]').attr('href').replace('mailto:', '');
        const tel = $('.col-md-8 table tr:eq(0) td:eq(2)').text().trim();
        let address = "";
        $('.col-md-8').contents().each((index, el) => {
            if (el.type === 'text') {
                const text = $(el).text().trim();
                if (text) {
                    address += text + ' ';
                }
            }
        });
        const zipCodeMatch = address.match(/\b\d{5}\b/);
        const cityMatch = address.replace(zipCodeMatch[0], '').trim();
        const city = cityMatch.split(/\d/)[0].trim();
        const zipCode = zipCodeMatch[0];
        const [firstName, lastName] = name.split(' ');
        return {
            FirstName: firstName,
            LastName: lastName,
            Email: email,
            Tel: tel,
            City: city,
            ZipCode: zipCode
        };
    } catch (error) {
        console.error(`Error fetching details from ${url}: ${error}`);
        return null;
    }
}

async function crawlPage(url) {
    const dataList = [];
    try {
        const html = await fetchHTML(url);
        const $ = cheerio.load(html);
        const therapistLinks = $('.search_list>table>tbody>tr td>a').map((i, el) => $(el).attr('href')).get();
        const detailPromises = therapistLinks.map(fetchDetails);
        const therapistDetails = await Promise.all(detailPromises);
        therapistDetails.forEach(detail => {
            if (detail) {
                dataList.push(detail);
            }
        });
        return dataList;
    } catch (error) {
        console.error(`Error crawling ${url}: ${error}`);
        return [];
    }
}

async function main() {
    const dataPageOne = await crawlPage(urlPageOne);
    const dataPageTwo = await crawlPage(urlPageTwo);
    const allData = [...dataPageOne, ...dataPageTwo];
    appendToCSV(allData, 'data.csv');
}

function appendToCSV(dataList, filePath) {
    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(dataList);
    fs.writeFileSync(filePath, csv, { flag: 'a' });
}

main();
