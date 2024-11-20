import OpenAI from 'openai';
import dotenv from 'dotenv';
import fs from "fs";
import { toFile } from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'node-fetch';
const { File } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
const apiKey = process.env.OPENAI_API_KEY;

const client = new OpenAI({ apiKey });
const filePath = path.resolve(__dirname, 'FitchGroupDisabilityForm.pdf');

// const client = new OpenAI({
// });
// console.log(client);
// console.log(fs.existsSync('src/utils/NASA Space Apps Challenge.pdf')); // Should print `true`
if (!fs.existsSync(filePath)) {
    throw new Error(`File does not exist at path: ${filePath}`);
}
// console.log('Resolved File Path:', filePath);

// async function testVectorStoreCreation() {
//     try {
//       const vectorStore = await client.beta.vectorStores.create({ name: "TestVectorStore" });
//       console.log("Vector Store Created:", vectorStore);
//     } catch (error) {
//       console.error("Error during vector store creation:", error);
//     }
//   }
  
//   testVectorStoreCreation();
  
// async function uploadTestFile() {
//     try {
//         // Create a vector store
//         const vectorStore = await client.beta.vectorStores.create({
//         name: 'TestVectorStore',
//         });

//         console.log(`Created Vector Store: ${vectorStore.id}`);

//         // Verify file existence
//         const filePath = path.resolve(__dirname, 'FitchGroupDisabilityForm.pdf');

//         if (!fs.existsSync(filePath)) {
//             throw new Error(`File does not exist at path: ${filePath}`);
//         }
//         console.log('Resolved File Path:', filePath);

//         // Log files parameter for debugging
//         // const files = [fs.createReadStream(filePath)];
//         // console.log('Files to upload:', files);
  
//         // console.log({
//         //     vectorStoreId: vectorStore.id,
//         //     files: [fs.createReadStream(filePath)], // Ensure this is an array of readable streams
//         // });

//         const fileBuffer = fs.readFileSync(filePath);
//         console.log('File Buffer Length:', fileBuffer.length); // Should print the file size in bytes
//         console.log('File Buffer:', fileBuffer.toString('utf-8').slice(0, 100)); // Logs first 100 characters

        
//         // Convert file to the appropriate format
//         // const uploadableFile = await toFile(fileBuffer, 'src/utils/FitchGroupDisabilityForm.pdf');
//         const uploadableFile = {
//             name: 'FitchGroupDisabilityForm.pdf',
//             data: fileBuffer,
//           };
//         //   console.log('Manually Prepared Uploadable File:', uploadableFile);
          
//         console.log('Full Prepared Uploadable File:', JSON.stringify(uploadableFile, null, 2));


//         // Upload a file
//         const fileBatch = await client.beta.vectorStores.fileBatches.uploadAndPoll({
//             vectorStoreId: vectorStore.id,
//             files: [uploadableFile],
//         });
//         console.log('Raw fileBatch response:', fileBatch);

  
//         console.log(`File batch status: ${fileBatch.status}`);
//         console.log(`Uploaded file IDs: ${fileBatch.fileIds}`);
//     } catch (error) {
//         console.error('Error during file upload test:', error);
//     }
//   }
  
async function uploadTestFile() {
    try {
        // Create a vector store
        const vectorStore = await client.beta.vectorStores.create({
            name: 'TestVectorStore',
        });

        console.log(`Created Vector Store: ${vectorStore.id}`);

        // Verify file existence
        const filePath = path.resolve(__dirname, 'FitchGroupDisabilityForm.pdf');
        if (!fs.existsSync(filePath)) {
            throw new Error(`File does not exist at path: ${filePath}`);
        }
        console.log('Resolved File Path:', filePath);

        const fileBuffer = fs.readFileSync(filePath);
        console.log('File Buffer Length:', fileBuffer.length);
        console.log('File Buffer Preview:', fileBuffer.toString('utf-8').slice(0, 100));

        // Convert file to the appropriate format
        const uploadableFile = await toFile(fileBuffer, 'FitchGroupDisabilityForm.pdf', { type: 'application/pdf'});
        // const uploadableFile = new File([fileBuffer], 'FitchGroupDisabilityForm.pdf', {
            // type: 'application/pdf',
        // });
        console.log('Prepared Uploadable File:', {
            name: uploadableFile.name,
            size: uploadableFile.size,
            type: uploadableFile.type,
        });

        // Upload the file
        const fileBatch = await client.beta.vectorStores.fileBatches.uploadAndPoll({
            vectorStoreId: vectorStore.id,
            files: [uploadableFile],
        });

        console.log('Raw fileBatch response:', fileBatch);
        console.log(`File batch status: ${fileBatch.status}`);
        console.log(`Uploaded file IDs: ${fileBatch.fileIds}`);
    } catch (error) {
        console.error('Error during file upload test:', error);
    }
}

uploadTestFile();