declare namespace google {
  namespace maps {
    type MapTypeStyle = any;
    type Map = any;
    type Marker = any;
    type Circle = any;
    type DirectionsRenderer = any;
    type Geocoder = any;
    type LatLng = any;
    type DirectionsService = any;
    type TravelMode = any;

    const Map: any;
    const Marker: any;
    const Circle: any;
    const DirectionsRenderer: any;
    const Geocoder: any;
    const LatLng: any;
    const DirectionsService: any;
    const MapTypeId: any;
    const SymbolPath: any;
    const TravelMode: any;
    const DirectionsStatus: any;

    namespace places {
      type Autocomplete = any;
      const Autocomplete: any;
    }
  }
}

interface Window {
  google?: any;
  gm_authFailure?: () => void;
  AndroidBridge?: any;
}
