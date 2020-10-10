//BLE Peripheral sample main

var Bleno = require( 'bleno' );
var BlenoPrimaryService = Bleno.PrimaryService;
var MyCharacteristic = require( './characteristic' );
var MyObj = null;

var MyName = "my-raspbverry-pi";
var ServiceUUID = '54f06857-695e-47e4-aea8-c78184ad6c75';

console.log( 'Bleno - ' + MyName );

Bleno.on( 'stateChange',function( state ) {
	console.log( 'Bleno.on -> stateChange ' + state );
	if ( state === 'poweredOn' ){
		Bleno.startAdvertising( MyName,[ServiceUUID] );
	}
	else{
		Bleno.stopAdvertising();
	}
});

Bleno.on( 'advertisingStart',function( error ) {
	console.log( 'Bleno.on -> advertisingStart ' + (error ? 'error ' + error : 'success') );
	MyObj = new MyCharacteristic();
	Bleno.setServices([new BlenoPrimaryService({uuid:ServiceUUID,characteristics:[MyObj]})]);
});

Bleno.on( 'advertisingStop',function( error ) {
	console.log( 'Bleno.on -> advertisingStop ' + (error ? 'error ' + error : 'success') );
});

Bleno.on('accept', function (clientAddress) {
	console.log("accept: " + clientAddress);
	if( MyObj != null ){
		MyObj.clientAddress = clientAddress;
	}
	Bleno.stopAdvertising();
});

Bleno.on('disconnect', function (clientAddress) {
	console.log("disconnect: " + clientAddress);
	Bleno.startAdvertising( MyName,[ServiceUUID] );
});
