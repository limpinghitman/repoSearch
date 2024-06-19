//workerFunctions.js

import {OpenAI} from 'openai';
import { promises as fsPromises } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { Document } from "langchain/document";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Pinecone } from '@pinecone-database/pinecone';
import * as dotenv from "dotenv";
import { Console } from 'console';

dotenv.config();

const openai = new OpenAI({
  // apiKey: enter API KEY 
});

// const knowledgeBaseFilePath = './File read/meloverse'; // Adjust this path according to your file location
const system= `
When responding to user queries, refer to the context provided in the end. If the user asks about a file or code, provide the URL of the file. Additionally, include a code snippet demonstrating its functionality along with a description of the code output from the context.Providing the complete file path is utmost important in the beginning of the response related to the file.

If the query is out of context, mention "This query does not relate to the context of organizations repositories but i can refer to the internet to answer your question" and then look up to the internet to answer the query in the new line
`


async function readKnowledgeBase(directoryPath, ignoreList = []) {
    try {
        let content = '';
        const files = await fs.readdir(directoryPath);
        for (const file of files) {
            if (ignoreList.includes(file)) {
                continue; // Skip if the file is in the ignore list
            }
            const filePath = path.join(directoryPath, file);
            const stats = await fs.stat(filePath);
            if (stats.isDirectory()) {
                // Recursively read files in subdirectories
                content += await readKnowledgeBase(filePath, ignoreList);
            } else {
                // Read content of files
                const fileContent = await fs.readFile(filePath, 'utf-8');
                content += fileContent + '\n'; // Concatenate content of each file with a newline separator
            }
        }
        return content;
    } catch (error) {
        console.error('Error reading knowledge base files:', error);
        return '';
    }
}

async function listFiles(directoryPath,ignoreList)
{
    try{
        const files=await fs.readdir(directoryPath);
        let fileList = [];
        for(const file of files){
            if(ignoreList.includes(file)) continue;

            const filePath = path.join(directoryPath,file);
            const stats = await fs.stat(filePath);
            if (!stats.isDirectory()) 
            {
                fileList.push(filePath);
            }
        }
        return fileList;
    }
    catch(error){
        console.error('Error listing files:', error);
        return [];
    }
}

export async function createEmbedding(doc, retryCount = 3) {
    try {
        console.log("createEmbedding started------------------------")
        const response = await axios.post('https://api.openai.com/v1/embeddings', {
            model: "text-embedding-3-small",
            input: doc,
            encoding_format: "float",
        }, {
            headers: {
                'Authorization': `Bearer ${openai.apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000 // 10 seconds timeout
        });
        console.log("--------------------createEmbedding ended------------------------")


        return response.data; // Return only the data portion of the response
    } catch (error) {
        if (retryCount > 0) {
            console.warn(`Retrying embedding creation... Attempts left: ${retryCount - 1}`);
            return await createEmbedding(doc, retryCount - 1);
        } else {
            console.error("ERROR OCCURRED during embedding creation: ", error);
            throw error;
        }
    }
}

export async function createChatCompletion(userPrompt,knowledge,systemInstructions,conversation) {
    try {
        console.log("Create chat completion started ..................")
        const systemConfig=`${systemInstructions}.  Context :$$$ ${knowledge} $$$`;
        const chatCompletion = await openai.chat.completions.create({
            model: "gpt-4-turbo",
            messages: [
                { "role": "system", "content": `${systemConfig}` },
                ...conversation,
                { "role": "user", "content": `${userPrompt}` },
            ],
        });
        console.log(".............. Create chat completion ended ..................")

        return chatCompletion;
    } catch (error) {
        console.error('Error creating chat completion:', error);
        throw error;
    }
}



// export function createPineconeObject(docList)
// {
//     const pineconeObjects = docList.map(e => {
//         return {
//             id: e.id,
//             values: e.values,
//             metadata: {fileUrl : e.webUrl, content: e.pageContent}
//         };
//     });

//     return pineconeObjects;
// }

export function createPineconeObject(docList) {
    const pineconeObjects = docList.map(e => {
        return {
            id: e.id,
            values: e.values,
            metadata: {
                fileUrl: e.webUrl,
                content: e.pageContent,
                contributors: e.usernames // Include contributors in the metadata
            }
        };
    });

    return pineconeObjects;
}



export async function documentLoading(fileList, fileUrls,uniqueUsernames) {
    //chunking
    console.log("document loading starting -------------------");
    const startTime = performance.now();

    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 800,
        chunkOverlap: 100,
    });

    //chunking each file

    const filePromises = fileList.map(async (file, index) => {
        const fileContent = await fs.readFile(file, 'utf-8');
        return { file, fileContent, fileUrl: fileUrls[index] }; // Include corresponding URL
    });

    const fileResults = await Promise.allSettled(filePromises);

    const splitterPromises = fileResults.map(async (res) => {
        if (res.status === 'fulfilled') {
            const { file, fileContent, fileUrl } = res.value;

            const splitDocs = await splitter.splitDocuments([
                new Document({ pageContent: fileContent }),
            ]);

            return { file, splitDocs, fileUrl };
        } else {
            console.error(`Failed to read the file: ${res.reason}`);
            return null;
        }
    });

    const splitResults = await Promise.allSettled(splitterPromises);
    const embeddingPromises = [];

    splitResults.forEach((res, index) => {
        if (res.status === 'fulfilled' && res.value) {
            const { file, splitDocs, fileUrl } = res.value;

            splitDocs.forEach((doc, i) => {
                if (Buffer.byteLength(doc.pageContent, 'utf-8') <= 4194304) {
                    // Ensure the chunk is within limit
                    embeddingPromises.push(
                        createEmbedding(doc.pageContent).then((embedding) => {
                            return {
                                ...doc,
                                values: embedding.data[0].embedding,
                                webUrl: fileUrl, // Use the provided URL
                                id: `${fileUrl}-chunk-${i.toString()}`,
                                usernames: uniqueUsernames
                            };
                        })
                    );
                } else {
                    console.error(`Chunk too large: ${doc.pageContent.length} bytes`);
                }
            });
            console.log("document loading ending------------------------");
        } else {
            console.error(`Failed to split document: ${res.reason}`);
        }
    });

    const docOutput = [];
    const embeddingResults = await Promise.allSettled(embeddingPromises);

    embeddingResults.forEach((result) => {
        if (result.status === 'fulfilled') {
            docOutput.push(result.value);
        } else {
            console.error(`Failed to create embedding: ${result.reason}`);
        }
    });

    // console.log("PRINTING CHUNKS IN JSON FORMAT\n\n")
    // console.log(docOutput);
    const endTime = performance.now();

    const timeTaken = endTime - startTime;
    // console.log(`Execution time: ${timeTaken}`); // 1937 => 1.93 s

    console.log("DOCOUT GENERATION ----------------------------");
    console.log(docOutput);
    return docOutput;
}

// export async function documentLoading(fileList, fileUrls, uniqueUsernames) {
//     //chunking
//     const startTime = performance.now();

//     const splitter = new RecursiveCharacterTextSplitter({
//         chunkSize: 800,
//         chunkOverlap: 100,
//     });

//     //chunking each file
//     const filePromises = fileList.map(async (file, index) => {
//         const fileContent = await fs.promises.readFile(file, 'utf-8');
//         return { file, fileContent, fileUrl: fileUrls[index] }; // Include corresponding URL
//     });

//     const fileResults = await Promise.allSettled(filePromises);

//     const splitterPromises = fileResults.map(async (res) => {
//         if (res.status === 'fulfilled') {
//             const { file, fileContent, fileUrl } = res.value;

//             const splitDocs = await splitter.splitDocuments([
//                 new Document({ pageContent: fileContent }),
//             ]);

//             return { file, splitDocs, fileUrl };
//         } else {
//             console.error(`Failed to read the file: ${res.reason}`);
//             return null;
//         }
//     });

//     const splitResults = await Promise.allSettled(splitterPromises);
//     const embeddingPromises = [];

//     splitResults.forEach((res, index) => {
//         if (res.status === 'fulfilled' && res.value) {
//             const { file, splitDocs, fileUrl } = res.value;

//             splitDocs.forEach((doc, i) => {
//                 if (Buffer.byteLength(doc.pageContent, 'utf-8') <= 4194304) { // Ensure the chunk is within limit
//                     embeddingPromises.push(
//                         createEmbedding(doc.pageContent).then((embedding) => {
//                             return {
//                                 ...doc,
//                                 values: embedding.data[0].embedding,
//                                 webUrl: fileUrl, // Use the provided URL
//                                 id: `${fileUrl}-chunk-${i.toString()}`,
//                                 contributors: uniqueUsernames, // Include contributors in the metadata
//                             };
//                         })
//                     );
//                 } else {
//                     console.error(`Chunk too large: ${doc.pageContent.length} bytes`);
//                 }
//             });
//         } else {
//             console.error(`Failed to split document: ${res.reason}`);
//         }
//     });

//     const docOutput = [];
//     const embeddingResults = await Promise.allSettled(embeddingPromises);

//     embeddingResults.forEach((result) => {
//         if (result.status === 'fulfilled') {
//             docOutput.push(result.value);
//         } else {
//             console.error(`Failed to create embedding: ${result.reason}`);
//         }
//     });

//     const endTime = performance.now();
//     const timeTaken = endTime - startTime;
//     return docOutput;
// }



// export async function pineconeSetup(directoryPath, ignoreList) {
//     const fileList = await listFiles(directoryPath, ignoreList);
//     const docList = await documentLoading(fileList);
//     const pineconeObj = createPineconeObject(docList);

//     console.log(pineconeObj);

//     const pc = new Pinecone({
//         apiKey: 'af4f0f5d-8889-40b4-87d9-4bfb662d646a',
//     });
//     const index = pc.index('chatbot-accelerator');

//     const upsertPromises = [];
//     for (const obj of pineconeObj) {
//         upsertPromises.push(index.namespace('temp-9').upsert([obj]));
//     }

//     try {
//         await Promise.all(upsertPromises);
//         console.log("Upsert successful");
//     } catch (error) {
//         console.error("Error during upsert:", error);
//     }
// }

// export async function pineconeSetup(docList) {

//     const pineconeObj = createPineconeObject(docList);

//     console.log("PINECONE FECTHING.....",pineconeObj);

//     const pc = new Pinecone({
//         apiKey: 'af4f0f5d-8889-40b4-87d9-4bfb662d646a',
//     });
//     const index = pc.index('chatbot-accelerator');

//     const upsertPromises = [];
//     for (const obj of pineconeObj) {
//         upsertPromises.push(index.namespace(process.env.PINECONE_NAMESPACE).upsert([obj]));
//     }

//     try {
//         await Promise.all(upsertPromises);
//         console.log("Upsert successful");
//     } catch (error) {
//         console.error("Error during upsert:", error);
//     }
// }

export async function pineconeSetup(docList) {
    const pineconeObj = createPineconeObject(docList);

    console.log("PINECONE FECTHING.....", pineconeObj);

    const pc = new Pinecone({
        apiKey: 'af4f0f5d-8889-40b4-87d9-4bfb662d646a',
    });
    const index = pc.index('chatbot-accelerator');

    const upsertPromises = [];
    for (const obj of pineconeObj) {
        upsertPromises.push(index.namespace(process.env.PINECONE_NAMESPACE).upsert([obj]));
    }

    try {
        await Promise.all(upsertPromises);
        console.log("Upsert successful");
    } catch (error) {
        console.error("Error during upsert:", error);
    }
}




async function queryPinecone(embedding, top_k) {
    console.log("queryPinecone started------------------------")

    const pc = new Pinecone({
        apiKey: 'af4f0f5d-8889-40b4-87d9-4bfb662d646a',
    });
    const index = pc.index('chatbot-accelerator');

    try {
        const response = await index.namespace("node-mongo-30").query({
            vector: embedding,
            topK: top_k,
            includeValues: true,
            includeMetadata: true
        });
    console.log("-----------------queryPinecone ended------------------------")

        return response.matches;
    } catch (error) {
        console.error("Error during Pinecone query:", error);
        throw error;
    }
}

export async function queryPineconeById(data_id)
{
    const pc = new Pinecone({
        apiKey: 'af4f0f5d-8889-40b4-87d9-4bfb662d646a',
    });
    const index = pc.index('chatbot-accelerator');

    const queryResponse = await index.namespace(process.env.PINECONE_NAMESPACE).query({
        id: data_id,
        topK: 1,
        includeValues: true,
        includeMetadata: true
    });

    return  queryResponse;
}

export async function listIDs(repoURL)
{
    const pc = new Pinecone({
        apiKey: 'af4f0f5d-8889-40b4-87d9-4bfb662d646a',
    });
    const index = pc.index('chatbot-accelerator');
    console.log("hello");
    const results = await index.namespace(process.env.PINECONE_NAMESPACE).listPaginated({ prefix: repoURL });
    console.log(results);
    return results;
}

// const res=await listIDs("https://codewave.vegaops.com/sharifPerwez/bit-node-express-mongo-sharif");
// console.log("The response is : ",res);

// console.log("Number of ids are : ",res.vectors.length);


async function getTopKMatches(userPrompt, topK) {
    try {
        console.log("getTopk Started --------")

        const embeddingResponse = await createEmbedding(userPrompt);
        const embedding = embeddingResponse.data[0].embedding; // Adjust data access
        const topKResults = await queryPinecone(embedding, topK);

        console.log(" LOGGING FETCH RESULTS: ", topKResults);
        return topKResults; // list of objects -> obj { id, score, values : embedding , metadata: {content ,fileURL}}
        console.log("-----------getTopk ended --------")

    } catch (error) {
        console.error("Error retrieving top K matches:", error);
        throw error;
    }
}


export async function userQuery(userPrompt,systemInstructions,conversation)
{
    try{
        // const userPrompt = "How to create an audio player?";
        console.log("userQuery Started --------")
        const topK = 10;
        const topKResults = await getTopKMatches(userPrompt,topK);
        let context = '';
        topKResults.forEach((obj)=>{
            context +=obj.metadata.fileUrl;
            context += obj.metadata.content;
        })
        // console.log("context : ",context);
        console.log("\n\nGenerating Response ...................................................\n\n");
        // console.log("Context: \n",context);
        const gptResponse = await createChatCompletion(userPrompt,context,systemInstructions,conversation);
        console.log("-----------userQuery ended --------")

        return gptResponse.choices[0].message.content;
    }
    catch(err)
    {
        console.log("User Query Error: ",userQuery);
        throw err;
    }
    
}

export async function processChangedFiles(fileUrls,clonedFiles) {
    const startTime = performance.now();

    // Chunking
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 800,
        chunkOverlap: 100,
    });

    const filePromises = fileUrls.map(async (fileUrl) => {
        try {
            const response = await axios.get(fileUrl);
            return { fileUrl, fileContent: response.data };
        } catch (error) {
            console.error(`Failed to fetch the file: ${fileUrl}`, error);
            return null;
        }
    });

    const fileResults = await Promise.allSettled(filePromises);

    const splitterPromises = fileResults.map(async (res) => {
        if (res.status === 'fulfilled' && res.value) {
            const { fileUrl, fileContent } = res.value;
            const splitDocs = await splitter.splitDocuments([
                new Document({ pageContent: fileContent })
            ]);

            return { fileUrl, splitDocs };
        } else {
            console.error(`Failed to process file: ${res.reason}`);
            return null;
        }
    });

    const splitResults = await Promise.allSettled(splitterPromises);
    const embeddingPromises = [];

    splitResults.forEach((res, index) => {
        if (res.status === 'fulfilled' && res.value) {
            const { fileUrl, splitDocs } = res.value;

            splitDocs.forEach((doc, i) => {
                if (Buffer.byteLength(doc.pageContent, 'utf-8') <= 4194304) { // Ensure the chunk is within limit
                    embeddingPromises.push(createEmbedding(doc.pageContent).then(embedding => {
                        return {
                            ...doc,
                            values: embedding.data[0].embedding,
                            fileUrl: fileUrl,
                            id: `${fileUrl}-chunk-${i.toString()}`
                        }
                    }));
                } else {
                    console.error(`Chunk too large: ${doc.pageContent.length} bytes`);
                }
            });
        } else {
            console.error(`Failed to split document: ${res.reason}`);
        }
    });

    const docOutput = [];
    const embeddingResults = await Promise.allSettled(embeddingPromises);

    embeddingResults.forEach((result) => {
        if (result.status === 'fulfilled') {
            docOutput.push(result.value);
        } else {
            console.error(`Failed to create embedding: ${result.reason}`);
        }
    });

    // console.log(docOutput);

    const endTime = performance.now();
    const timeTaken = endTime - startTime;
    console.log(`Execution time: ${timeTaken}`); // 1937 => 1.93 s

    return docOutput;
}

export async function deleteFromPinecone(fileUrls, namespace) {
    const pc = new Pinecone({
        apiKey: 'af4f0f5d-8889-40b4-87d9-4bfb662d646a',
    });
    const index = pc.index('chatbot-accelerator').namespace(namespace);

    // 1. Search among the Pinecone IDs
    const results = await index.listPaginated();
    const allIds = results.vectors.map(obj=>{
        return obj.id;
    });

    const idsToDelete = allIds.filter(id => fileUrls.some(url => id.includes(url)));

    console.log(idsToDelete);


    if (idsToDelete.length > 0) {
        await index.deleteMany(idsToDelete);
        console.log('Deleted IDs:');
        idsToDelete.forEach(id => console.log(id));
    } else {
        console.log('No matching IDs found for deletion.');
    }

}



