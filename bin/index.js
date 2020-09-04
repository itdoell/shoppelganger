#!/usr/bin/env node

const fs = require('fs');
const yargs = require("yargs");
const themeKit = require('@shopify/themekit');
const fetch = require("node-fetch");
const yaml = require('js-yaml');
const dir = require('os').homedir() + '/.shoppelganger'; //directory where we're saving the theme
const pollFrequency = 2000; // for checking if a bulk operation has completed
let productsArray = [];


// setup arguments
const options = yargs
    .usage('Usage: -c <env> -t <env>')
    .alias('c', 'copy')
    .describe('c', 'Shopify store you are copying from')
    .alias('t', 'to')
    .describe('t', 'Shopify store you are copying to')
    .alias("p", "products")
    .describe("p", "Only transfer products")
    .demandOption(['c', 't'])
    .help('h')
    .alias('h', 'help')
    .argv;

// read config file in shopify
const config = yaml.load(fs.readFileSync('./config.yml', {
    encoding: 'utf-8'
}));

// get necessary info from stores
const copyStore = {
    token: config[options.c].password,
    store: config[options.c].store,
}
const toStore = {
    token: config[options.t].password,
    store: config[options.t].store,
}


// listApps();
// return false;


console.log(`Copying ${options.c} to ${options.t}!`);


// Get all products from the store to delete
fetch(`https://${toStore.store}/admin/api/graphql.json`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": toStore.token
        },
        body: JSON.stringify({
            query: `mutation {
        	bulkOperationRunQuery(
        		query: """
                {
                 products {
                    edges {
                      cursor
                      node {
                        id
                      }
                    }
                  }

                }
            		"""
            	) {
            		bulkOperation {
            			id
            			status
            		}
            		userErrors {
            			field
            			message
            		}
            	}
            }`
        })
    })
    .then(result => {
        // console.log('received result', result);
        return result.json();
    })
    .then(bulkOp => {
        // console.log(JSON.stringify(bulkOp));
        const bulkOperationGid = bulkOp.data.bulkOperationRunQuery.bulkOperation.id;
        console.log(bulkOperationGid);
        console.log(JSON.stringify(bulkOp));
        setTimeout(function () {
            pollBulkOp2(bulkOperationGid);
        }, 5000);

    }).catch(err => console.error(err));



    function pollBulkOp2(bulkOperationGid) {
        console.log('called pollBulkOp2')
      fetch(`https://${toStore.store}/admin/api/graphql.json`, {
          method: "POST",
          headers: {
              "Content-Type": "application/json",
              "X-Shopify-Access-Token": toStore.token
          },
          body: JSON.stringify({
              query: `{
              node(id: "${bulkOperationGid}") {
                ... on BulkOperation {
                  id
                  status
                  errorCode
                  createdAt
                  completedAt
                  objectCount
                  fileSize
                  url
                  partialDataUrl
                }
              }
            }`
          })
      }).then(result => {
          return result.json();
      }).then(body => {
          // check if it's complete, if not poll again
          // TODO: Add check if it breaks
          console.log(JSON.stringify(body))
          if(body.data.node.status !== 'COMPLETED') {
              console.log('not done yet, try again')
              setTimeout(() => {
                  pollBulkOp2(bulkOperationGid)
              }, pollFrequency);
          } else {

              parseBulkOp2(body.data.node.url);

          }

      }).catch(err => console.error(err));

    }

    function parseBulkOp2(url) {
        console.log('fetch jsonl from url',url);
        if(!url) {
            console.log('No products to delete');
            grabAndTransferProducts();
            return;
        }
        fetch(url)
        .then(res => {
            return res.text();
        })
        .then(data => {

            let product = {};


            var dataArr = data
            .split("\n")
            .filter(l => l);

            let productString = ``;
            dataArr.forEach((val, key, arr) => {
              const obj = JSON.parse(val);
              console.log(key)
              console.log(obj)
              // const id = obj.id.substr(obj.id.lastIndexOf('/') + 1);
              const id = obj.id.substr(obj.id.lastIndexOf('/') + 1);

              console.log("ID::::::", id)


              productString += `Product${key}: productDelete(input:{id: "gid://shopify/Product/${id}"})
              {
                  deletedProductId
              }`

        })

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
                console.log('Finished deleting products!')

                grabAndTransferProducts();
            });

        }).catch(err => console.error(err));
    }







function grabAndTransferProducts() {
    // Get products from store using GraphQL
    fetch(`https://${copyStore.store}/admin/api/graphql.json`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Shopify-Access-Token": copyStore.token
            },
            body: JSON.stringify({
                query: `mutation {
            	bulkOperationRunQuery(
            		query: """
            		 {
            			products {
            		          edges {
            		              cursor
            		              node {
            		                id
            		                title
                                    description
            		                vendor
            		                productType
                                    hasOnlyDefaultVariant
                                    tags
            		                images {
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
            		              metafields {
            		                edges {
            		                  node {
            		                    id
            		                  }
            		                }
            		              }
            		              variants {
            		                edges {
            		                  node {
            		                    id
            		                    barcode
            		                    compareAtPrice
                                        position
                                        title
            		                    fulfillmentService {
            		                      id
            		                      inventoryManagement
            		                    }
            		                    weight
            		                    weightUnit
            		                    inventoryItem {
            		                      id
            		                      unitCost {
            		                        amount
            		                        currencyCode
            		                      }
            		                      countryCodeOfOrigin
            		                      harmonizedSystemCode
            		                      provinceCodeOfOrigin
            		                      tracked
            		                    }
            		                    inventoryPolicy
            		                    inventoryQuantity
            		                    metafields {
            		                      edges {
            		                        node {
            		                          id
            		                        }
            		                      }
            		                    }
            		                    price
            		                    sku
            		                    taxable
            		                    taxCode
                                        images {
                                          src
                                        }
            		                  }
            		                }
            		              }
            		              vendor
            		              totalInventory
            		            }
            		          }

            		        }
                		}
                		"""
                	) {
                		bulkOperation {
                			id
                			status
                		}
                		userErrors {
                			field
                			message
                		}
                	}
                }`
            })
        })
        .then(result => {
            console.log('received result', result);
            return result.json();
        })
        .then(bulkOp => {
            console.log(JSON.stringify(bulkOp));
            const bulkOperationGid = bulkOp.data.bulkOperationRunQuery.bulkOperation.id;
            console.log(bulkOperationGid);
            console.log(JSON.stringify(bulkOp));
            setTimeout(function () {
                pollBulkOp(bulkOperationGid);
            }, 5000);

        }).catch(err => console.error(err));

}




function pollBulkOp(bulkOperationGid) {
    console.log('called pollBulkOp')
  fetch(`https://${copyStore.store}/admin/api/graphql.json`, {
      method: "POST",
      headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": copyStore.token
      },
      body: JSON.stringify({
          query: `{
          node(id: "${bulkOperationGid}") {
            ... on BulkOperation {
              id
              status
              errorCode
              createdAt
              completedAt
              objectCount
              fileSize
              url
              partialDataUrl
            }
          }
        }`
      })
  }).then(result => {
      return result.json();
  }).then(body => {
      // check if it's complete, if not poll again
      // TODO: Add check if it breaks
      if(body.data.node.status !== 'COMPLETED') {
          console.log('not done yet, try again')
          setTimeout(() => {
              pollBulkOp(bulkOperationGid)
          }, pollFrequency);
      } else {
          console.log('done, parse options');
          parseBulkOp(body.data.node.url);
      }

  }).catch(err => console.error(err));

}
//
// //csv
//
//
function parseBulkOp(url) {

    fetch(url)
    .then(res => {
        return res.text();
    })
    .then(data => {

        let product = {};

        let dataArr = data
        .split("\n")
        .filter(l => l);

        dataArr.forEach((val, key, arr) => {
          const obj = JSON.parse(val);
          console.log(JSON.stringify(obj));

          // new product
          if(!obj.__parentId) {
              // push the last product if it exists
              if(Object.keys(product).length !== 0) {
                  productsArray.push(product);
              }

              // start building new product
              product = {
                  ...obj,
                  images: []
              };
          }
          // Add image to product
          if(obj.src) {
              product.images.push({src: obj.src});
          }

          // grab variant information
          if(obj.id && obj.__parentId && !product.hasOnlyDefaultVariant) {
              product.variants = product.variants || [];
              console.log('VARIANT')
              console.log(JSON.stringify(obj));
              let variant = {
                  title: obj.title,
                  position: obj.position,
                  sku: obj.sku,
                  price: obj.price,
                  images: obj.images,
                  tags: obj.tags,
                  price: obj.price
              }
              product.variants.push(variant);
          }
          console.log(product);

          console.log('data length',dataArr.length)

          // if we're on the last iteration, push the product to the array
          if (Object.is(dataArr.length - 1, key)) {
              if(Object.keys(product).length !== 0) {
                  productsArray.push(product);
                  console.log(JSON.stringify(productsArray));
              }
              // start building the actual products
              buildProducts(productsArray)
          }


        });


    }).catch(err => console.error(err));
}


function buildProducts(products) {

    console.log('building products array');

    let productString = '';

    // TODO: Refactor - can we avoid O(n^2)?

    for (let i = 0; i < products.length; i++) {
        let product = products[i];
        let variantString = '';
        let imageArrayString = ``;
        for (let i = 0; i < product.images.length; i++) {
            let image = product.images[i].src;
            imageArrayString += `{src: "${image}"},`
        }
        if(product.variants) {
            for (let i = 0; i < product.variants.length; i++) {
                let variant = product.variants[i];

                let variantImageString = ``;
                for (let i = 0; i < variant.images.length; i++) {
                    variantImageString = variant.images[i].src;
                }
                console.log('***************************');
                console.log('***************************');
                console.log('***************************');
                console.log(product.images[i].src);
                console.log(variant.images[0].src);
                console.log('***************************');
                console.log('***************************');
                console.log('***************************');

                variantString += `
                    {
                        title: "${variant.title}"
                        position: ${variant.position}
                        sku: "${variant.sku}"
                        price: "${variant.price}"
                        options: "${variant.title}"
                        imageSrc: "${variant.images[0].src}"
                    },

                `
                console.log("VARIANT STRING");
                console.log(variantString);
            }
        }

        // let images = product.images.edges.map(x => {
        //     return x.node;
        // });
        // let img = JSON.stringify(images[0])
        // console.log()
        // let imageObj = JSON.parse(img);
        // console.log('IMAGE' + imageObj.src);
        // console.log('image source',);


        productString += `Product${i}: productCreate(input: {
            title: "${product.title}",
            productType: "${product.productType}",
            vendor: "${product.vendor}",
            options: ${JSON.stringify(product.options.map(x => x.name))},
            variants: [${variantString}],
            images: [${imageArrayString}],
            tags: "${product.tags.join()}",



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


            console.log('PRODUCT COUNT:',products.length);


            console.log("data returned:\n", JSON.stringify(data));
            // console.log(JSON.stringify(data));
            console.log('Finished creating products!')
            if(options.p) {
                console.log('only products transferred');
                return;
            } else {
                transferTheme();
            }

        });
}


function transferTheme() {
    try {
        console.log('Downloading theme');
        // make directory if it doesn't already exist
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir);
        }
        // download the theme
        themeKit.command('download', {
            dir: dir,
            env: options.c
        }).then(function(){
            // deploy the theme
            console.log('Deploying theme');
            themeKit.command('deploy', {
                dir: dir,
                env: options.t
            }).then(function(){
                console.log('Theme deployment finished');

            })
        });

    } catch (e) {
        console.log(e);
    }
}


function listApps() {
    fetch(`https://${copyStore.store}/admin/api/graphql.json`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": copyStore.token
        },
        body: JSON.stringify({
            query: `{
              appInstallations(first:5) {
                edges {
                  node {
                    id
                    app {
                      id
                      appStoreAppUrl
                      description
                      developerName
                      title
                      installUrl
                    }
                  }
                }
              }
            }`
        })
    }).then(result => {
        return result.json();
    }).then(body => {
        console.log(body);

    }).catch(err => console.error(err));
}
