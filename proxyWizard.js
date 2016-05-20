var fs				= require('fs');
var httpRequest 	= require('nodehttpwrapper');
var index			= 0;
var defaultDelay	= 200;

var cityList	= [];
var bannedIps	= [];
var proxyList	= [];

var date		= new Date();

var dateArray	=
[
	date.getFullYear()
	,twoDigits( date.getMonth()+1)
	,twoDigits(date.getDate())
];

//Contains the banned ip's
var bannedFile	= 'data/'+dateArray.join('')+'.json';
dateArray.push( twoDigits( date.getHours() ) );
var hourFile	= 'data/'+dateArray.join('')+'.json';



var dir = './data';

if (!fs.existsSync( dir ))
{
   fs.mkdirSync( dir );
}


function getDefaultHeaders()
{
	return {
		'Accept'					: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
		,'Connection'				: 'keep-alive'
		,'Accept-Encoding'			: 'gzip, deflate, sdch'
		,'Accept-Language'			: 'en-US,en;q=0.8,ja;q=0.6,de;q=0.4'
		,'Upgrade-Insecure-Requests': '1'
		,'User-Agent'				: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.47 Safari/537.36'
	};
}

var success = function ( values )
{
	cityList	= values[ 0 ];
	proxyList	= values[ 1 ];
	bannedIps	= values[ 2 ];

	console.log( 'Cities '+cityList.length+' proxyList '+proxyList.length+' BannedIps '+bannedIps.length );
	checkLocation();
};

var bannedPromise		= new Promise(function(resolve,reject)
{
	fs.readFile(bannedFile, 'utf8', function (err,data)
	{
		if (err)
		{
			resolve([]);
			return;
		}
		resolve( JSON.parse( data ) );
	});
});

var citiesPromise 		= new Promise(function(resolve,reject)
{
	getCities
	({
		callback	: function(cityList)
		{
			resolve( cityList );
		}
	});
});

var proxyPromise		= new Promise(function(resolve,reject)
{
	getProxyList
	({
		debug		: true
		,callback	: function( proxyArray )
		{
			if( proxyArray.length )
				resolve( proxyArray );
			else
				reject('No proxies Found');
		}
	});
});

var fail	= function( reason )
{
	console.log('Life Sucks '+reason );
};

Promise.all([citiesPromise ,proxyPromise ,bannedPromise]).then( success, fail );


function checkCraigListCity( ipAddress, craigslistResponse )
{
	for(var i=0;i<cityList.length;i++)
	{
		if( craigslistResponse.indexOf( cityList[ i ] ) !== -1 )
		{
			//Make the connection
			console.log( 'Found '+ipAddress );
			//saveProxyLists();
			return;
		}
	}

	setTimeout( checkLocation, defaultDelay );
}

function checkLocation()
{
	console.log('Checking Location',index);

	if( index >= proxyList.length )
	{
		console.log('UNSUCCESSFULL ATEMPT TO CONNECT no more proxies found');

		fs.writeFile( bannedFile , JSON.stringify( bannedIps ), function(err)
		{
			if(err) return console.log(err);

			console.log("File saved!");
		});
		return;
	}

	console.log('Checking Location',index);
	console.log('Here we go');

	var ip		= proxyList[ index++ ];
	var	found 	= bannedIps.findIndex(function(proxy){ return proxy.ipAddress === ip;}) !== -1;

	if(  found )
	{
		console.log('Was Found check another');
		setTimeout( checkLocation, defaultDelay );
		return;
	}

	console.log('Checking Ip');

	httpRequest
	({
		debug		: true
		,url		: 'http://ip-api.com/json/'+ip.ipAddress
		,type		: 'json'
		,success	: function( data )
		{
			data.ipAddress = ip.ipAddress;
			console.log('Data type is',typeof data);

			fs.appendFile('data/ipLocation.log', JSON.stringify( data )+'\r', function (err)
			{
				if( err )
					console.log( err );
			});

			console.log('Success Checking and is '+data.countryCode );

			if( data.countryCode  !== 'US' )
			{

				bannedIps.push( data.ipAddress );
				setTimeout( checkLocation, defaultDelay );
			}
			else
			{
				console.log("Found One "+ip.ipAddress);
				//var headers		= getDefaultHeaders();
				//var f			= function( x )
				//{
				//	return function(data)
				//	{
				//		console.log("Checking Craiglist");
				//		checkCraigListCity( x, craigslistResponse );
				//	};
				//};

				//httpRequest
				//({
				//	debug		: true
				//	,headers	: headers
				//	,url		: 'http://craigslist.org'
				//	,success	: f( data.ipAddress )
				//	,error		: function()
				//	{
				//		setTimeout( checkLocation, 1500 );
				//	}
				//});
			}
		}
		,error	: function( xxx )
		{
			console.log( xxx );
			setTimeout( checkLocation, defaultDelay ); //Do not make to many requests
		}
	});
}


//Read the file with the proxi lists

/*
	readProxyFiles
	({
		callback	: function(proxyListArray){ }
	});
 */
function getProxyList( obj )
{
	if( obj.debug ) console.log('READING '+hourFile);

	fs.readFile( hourFile, 'utf8', function (err,data)
	{
		if (err)
		{
			if( obj.debug ) console.log('Error on read File '+hourFile );

			getProxiesFromServer( obj );
			return;
		}
		obj.callback( JSON.parse( data ) );
	});
}

function twoDigits(number)
{
	return number<10 ? '0'+number : number;
}


function saveProxyLists()
{
	fs.appendFile('data/proxyLists.log', JSON.stringify( proxyList )+'\r', function (err)
	{
		if( err ) console.log( err );
	});
}
/*
 	getProxiesFromServer
	({
		debug		: false
		,callback	: function( proxyListArray )
		{

		}
	});
 */
function getProxiesFromServer(obj)
{
	var ProxyLists	= require('proxy-lists');
	var options =
	{
		countries			: ['us']
		,protocols			: ['http', 'https']
		,anonymityLevels	: ['anonymous', 'elite']
	};

	//var gettingProxies = ProxyLists.getProxies(options);
	var proxyServerList	= [];
	var gettingProxies	= ProxyLists.getProxiesFromSource('freeproxylists', options);

	gettingProxies.on('data', function( proxiesArray )
	{
		if( obj.debug ) console.log('Proxies Data Arrive');

		for(var i=0;i<proxiesArray.length;i++)
		{
			proxyServerList.push( proxiesArray[ i ] );
		}
	});

	gettingProxies.on('error', function(error)
	{
		if( obj.debug ) console.log('Getting proxies Error');
	});

	gettingProxies.once('end', function()
	{
		if( obj.debug ) console.log('Getting proxies end Proxies Found ',proxyServerList.length );

		fs.writeFile( hourFile , JSON.stringify( proxyServerList ), function(err)
		{
			if(err) return console.log(err);

			console.log("File saved!");
		});

		obj.callback( proxyServerList );
	});
}
/*
	getCities
	({
		callback	: function(dataList)
		{

		});
	});
*/
function getCities( obj )
{
	fs.readFile('data/cityLists.txt', 'utf8', function (err,data)
	{
		if (err)
		{
			obj.callback([]);
			return;
		}
		obj.callback( data.split('\r') );
	});
}
