#!/usr/bin/env node

const fs = require('fs');
const yargs = require("yargs");
const themeKit = require('@shopify/themekit');
const fetch = require("node-fetch");
const yaml = require('js-yaml');
const dir = require('os').homedir() + '/.shoppelganger'; //directory where we're saving the theme


// setup arguments
const options = yargs
 .usage('Usage: -c <env> -t <env>')
 .demandOption(['c','t'])
 .argv;

const config = yaml.load(fs.readFileSync('./config.yml', {encoding: 'utf-8'}));

// get necessary info from stores
const copyStore = {
    token: config[options.c].password,
    store: config[options.c].store,
}
const toStore = {
    token: config[options.t].password,
    store: config[options.t].store,
}


console.log(`Copying ${options.c} to ${options.t}!`);



// Get products from store using GraphQL
fetch(`https://${copyStore.store}/admin/api/graphql.json`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Shopify-Access-Token": copyStore.token
  },
  body: JSON.stringify({
    query: `{
      products(first: 5) {
        edges {
          cursor
          node {
            id
            title
            vendor
            productType
            images(first: 10) {
              edges {
                node {
                  src
                }
              }
            }
            options {
              name
              values
            }
            variants(first: 100) {
              edges {
                node {
                  id
                  title
                  position
                  sku
                  price
                  images {
                    src
                  }
                }
              }
            }
            tags
          }
        }
      }
    }`
  })
})
  .then(result => {
    return result.json();
  })
  .then(products => {

    buildProducts(products);
}).catch(err => {
    console.log(err);
});







function buildProducts(products) {


    var productString = ``;

    for (let i = 0; i < products.data.products.edges.length; i++) {
        let product = products.data.products.edges[i].node;


        let variantString = ``;
        for (let i = 0; i < product.variants.edges.length; i++) {
            let variant = product.variants.edges[i].node;

            variantString += `
                {
                    title: "${variant.title}"
                    position: ${variant.position}
                    sku: "${variant.sku}"
                    price: "${variant.price}"
                    options: ${JSON.stringify(variant.title.split("/").map(x => x.trim()))}
                },

            `
            // console.log(variantString);
        }
        var images = product.images.edges.map(x=> {
            return x.node;
        });
        var img = JSON.stringify(images[0])
        // console.log()
        var imageObj = JSON.parse(img);
        console.log('IMAGE'+imageObj.src);
        // console.log('image source',);
        productString += `Product${i}: productCreate(input: {
            title: "${product.title}",
            productType: "${product.productType}",
            vendor: "${product.vendor}",
            options: ${JSON.stringify(product.options.map(x => x.name))},
            variants: [${variantString}],
            images: [
                {
                src: "${imageObj.src}"
                }
            ]

        }) {
          product {
            id
          }
        }`
    }

    // console.log(productString);
    fetch(`https://${toStore.store}/admin/api/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": toStore.token
      },
      body: JSON.stringify({
        query: `mutation {
          ${productString}
        }`
      })
    })
      .then(result => {
        return result.json();
      })
      .then(data => {
        // console.log("data returned:\n", data);
        // console.log(JSON.stringify(data));
        console.log('Finished creating products!')
      });
}

// try {
//     console.log('Downloading theme');
//     // make directory if it doesn't already exist
//     if (!fs.existsSync(dir)){
//         fs.mkdirSync(dir);
//     }
//     // download the theme
//     themeKit.command('download', {
//         dir: dir,
//         env: options.c
//     }).then(function(){
//         // deploy the theme
//         console.log('Deploying theme');
//         themeKit.command('deploy', {
//             dir: dir,
//             env: options.t
//         }).then(function(){
//             console.log('Theme deployment finished')
//         })
//     });
//
// } catch (e) {
//     console.log(e);
// }