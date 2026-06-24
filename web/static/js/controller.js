(function(angular) {
    'use strict';

    var robotshop = angular.module('robotshop', ['ngRoute']);

    robotshop.factory('currentUser', function() {
        var data = {
            uniqueid: '',
            user: {},
            cart: {
                total: 0
            }
        };

        return data;
    });

    robotshop.config(['$routeProvider', '$locationProvider', function($routeProvider, $locationProvider) {
        $routeProvider.when('/', {
            templateUrl: 'splash.html',
            controller: 'shopform'
        }).when('/search/:text', {
            templateUrl: 'search.html',
            controller: 'searchform'
        }).when('/product/:sku', {
            templateUrl: 'product.html',
            controller: 'productform'
        }).when('/login', {
            templateUrl: 'login.html',
            controller: 'loginform'
        }).when('/cart', {
            templateUrl: 'cart.html',
            controller: 'cartform'
        }).when('/shipping', {
            templateUrl: 'shipping.html',
            controller: 'shipform'
        }).when('/payment', {
            templateUrl: 'payment.html',
            controller: 'paymentform'
        }).when('/404', {
            templateUrl: '404.html',
            controller: 'notfoundform'
        }).otherwise({
            redirectTo: '/'
        });

        $locationProvider.html5Mode(true);
    }]);

    robotshop.run(function($rootScope, $templateCache) {
        $rootScope.$on('$viewContentLoaded', function() {
            console.log('>>> clearing cache');
            $templateCache.removeAll();
        });

        $rootScope.$on('$routeChangeSuccess', function(event, next, current) {
            if (typeof ineum !== 'undefined') {
                ineum('page', next.loadedTemplateUrl);
            }
        });
    });

    robotshop.controller('shopform', function($scope, $http, $location, currentUser) {
        $scope.data = {};

        $scope.data.uniqueid = 'foo';
        $scope.data.categories = [];
        $scope.data.products = {};
        $scope.data.searchText = '';
        $scope.data.selectedCategory = 'Home';

        $scope.data.cart = {
            total: 0
        };

        $scope.getProducts = function(category) {
            if ($scope.data.products[category]) {
                $scope.data.products[category] = null;
            } else {
                $http({
                    url: '/api/catalogue/products/' + category,
                    method: 'GET'
                }).then(function(res) {
                    $scope.data.products[category] = res.data;
                }).catch(function(e) {
                    console.log('ERROR', e);
                });
            }
        };

        /*
         * Added for new left sidebar UI.
         * This keeps selected category highlighted.
         */
        $scope.selectCategory = function(cat) {
            $scope.data.selectedCategory = cat;

            if (cat === 'Home') {
                $location.url('/');
                return;
            }

            $scope.getProducts(cat);
        };

        $scope.search = function() {
            if ($scope.data.searchText) {
                $location.url('/search/' + $scope.data.searchText);
                $scope.data.searchText = '';
            }
        };

        function getCategories() {
            $http({
                url: '/api/catalogue/categories',
                method: 'GET'
            }).then(function(res) {
                $scope.data.categories = res.data;
                console.log('categories loaded');
            }).catch(function(e) {
                console.log('ERROR', e);
            });
        }

        function getUniqueid() {
            return new Promise(function(resolve, reject) {
                $http({
                    url: '/api/user/uniqueid',
                    method: 'GET'
                }).then(function(res) {
                    resolve(res.data.uuid);
                }).catch(function(e) {
                    console.log('ERROR', e);
                    reject(e);
                });
            });
        }

        console.log('shopform starting...');
        getCategories();

        if (!currentUser.uniqueid) {
            console.log('generating uniqueid');

            getUniqueid().then(function(id) {
                $scope.data.uniqueid = id;
                currentUser.uniqueid = id;

                if (typeof ineum !== 'undefined') {
                    ineum('user', id);
                    ineum('meta', 'environment', 'production');
                    ineum('meta', 'variant', 'normal price');
                }
            }).catch(function(e) {
                console.log('ERROR', e);
            });
        }

        $scope.$watch(function() {
            return currentUser.uniqueid;
        }, function(newVal, oldVal) {
            if (newVal !== oldVal) {
                $scope.data.uniqueid = currentUser.uniqueid;

                if (typeof ineum !== 'undefined') {
                    if (!currentUser.uniqueid.startsWith('anonymous')) {
                        console.log('Setting user details', currentUser);
                        ineum(
                            'user',
                            currentUser.uniqueid,
                            currentUser.user.name,
                            currentUser.user.email
                        );
                    }
                }
            }
        });

        $scope.$watch(function() {
            return currentUser.cart.total;
        }, function(newVal, oldVal) {
            if (newVal !== oldVal) {
                $scope.data.cart = currentUser.cart;
            }
        });
    });

    robotshop.controller('searchform', function($scope, $http, $routeParams) {
        $scope.data = {};
        $scope.data.searchResults = [];

        function search(text) {
            if (text) {
                $http({
                    url: '/api/catalogue/search/' + text,
                    method: 'GET'
                }).then(function(res) {
                    console.log('search results', res.data);
                    $scope.data.searchResults = res.data;
                }).catch(function(e) {
                    console.log('ERROR', e);
                });
            }
        }

        var text = $routeParams.text;
        console.log('search init with', text);
        search(text);
    });

    robotshop.controller('productform', function($scope, $http, $routeParams, $timeout, $location, currentUser) {
        $scope.data = {};
        $scope.data.message = ' ';
        $scope.data.product = {};
        $scope.data.rating = {};
        $scope.data.rating.avg_rating = 0;
        $scope.data.quantity = 1;

        $scope.addToCart = function() {
            var sku = $scope.data.product.sku;
            var url = '/api/cart/add/' + currentUser.uniqueid + '/' + sku + '/' + $scope.data.quantity;

            console.log('addToCart', url);

            /*
             * Controlled failure scenario:
             * Product should load normally with image/details.
             * If SKU is HPTD, Add to Cart redirects to custom 404 page.
             */
            if (sku === 'HPTD') {
                console.log('Controlled Add to Cart failure for SKU:', sku);
                $location.url('/404');
                return;
            }

            $http({
                url: url,
                method: 'GET'
            }).then(function(res) {
                console.log('cart', res.data);
                currentUser.cart = res.data;
                $scope.data.message = 'Added to cart';
                $timeout(clearMessage, 3000);
            }).catch(function(e) {
                console.log('ADD TO CART ERROR:', e);

                if (e.status === 404) {
                    console.log('Cart service returned 404. Redirecting to /404.');
                    $location.url('/404');
                    return;
                }

                $scope.data.message = 'ERROR ' + e;
                $timeout(clearMessage, 3000);
            });
        };

        $scope.rateProduct = function(score) {
            console.log('rate product', $scope.data.product.sku, score);

            var url = '/api/ratings/api/rate/' +
                $scope.data.product.sku +
                '/' +
                score;

            $http({
                url: url,
                method: 'PUT'
            }).then(function(res) {
                $scope.data.message = 'Thank you for your feedback';
                $timeout(clearMessage, 3000);
                loadRating($scope.data.product.sku);
            }).catch(function(e) {
                console.log('ERROR', e);
            });
        };

        $scope.glowstan = function(vote, val) {
            console.log('glowstan', vote);

            var idx = vote;

            while (idx > 0) {
                document.getElementById('vote-' + idx).style.opacity = val;
                idx--;
            }
        };

        function loadProduct(sku) {
            $http({
                url: '/api/catalogue/product/' + sku,
                method: 'GET'
            }).then(function(res) {
                $scope.data.product = res.data;
            }).catch(function(e) {
                console.log('PRODUCT LOAD ERROR:', e);

                if (e.status === 404) {
                    $scope.data.product = {};
                    $scope.data.message = '';
                    $location.url('/404');
                    return;
                }

                $scope.data.message = 'ERROR loading product';
                $timeout(clearMessage, 3000);
            });
        }

        function loadRating(sku) {
            $http({
                url: '/api/ratings/api/fetch/' + sku,
                method: 'GET'
            }).then(function(res) {
                $scope.data.rating = res.data;
            }).catch(function(e) {
                console.log('ERROR', e);
            });
        }

        function clearMessage() {
            console.log('clear message');
            $scope.data.message = ' ';
        }

        loadProduct($routeParams.sku);
        loadRating($routeParams.sku);
    });

    robotshop.controller('cartform', function($scope, $http, $location, currentUser) {
        $scope.data = {};
        $scope.data.cart = {};
        $scope.data.cart.total = 0;
        $scope.data.uniqueid = currentUser.uniqueid;

        $scope.buy = function() {
            $location.url('/shipping');
        };

        $scope.change = function(sku, qty) {
            var url = '/api/cart/update/' +
                $scope.data.uniqueid +
                '/' +
                sku +
                '/' +
                qty;

            console.log('change', url);

            $http({
                url: url,
                method: 'GET'
            }).then(function(res) {
                $scope.data.cart = res.data;
                currentUser.cart = res.data;
            }).catch(function(e) {
                console.log('ERROR', e);
            });
        };

        function loadCart(id) {
            $http({
                url: '/api/cart/cart/' + id,
                method: 'GET'
            }).then(function(res) {
                var cart = res.data;

                if (
                    cart.items &&
                    cart.items.length > 0 &&
                    cart.items[cart.items.length - 1].sku == 'SHIP'
                ) {
                    $http({
                        url: '/api/cart/update/' + id + '/SHIP/0',
                        method: 'GET'
                    }).then(function(res) {
                        currentUser.cart = res.data;
                        $scope.data.cart = res.data;
                    }).catch(function(e) {
                        console.log('ERROR', e);
                    });
                } else {
                    $scope.data.cart = cart;
                }
            }).catch(function(e) {
                console.log('ERROR', e);
            });
        }

        loadCart($scope.data.uniqueid);
        console.log('cart init');
    });

    robotshop.controller('shipform', function($scope, $http, $location, currentUser) {
        $scope.data = {};
        $scope.data.countries = [];
        $scope.data.selectedCountry = '';
        $scope.data.selectedLocation = '';
        $scope.data.disableCity = true;
        $scope.data.shipping = null;

        var autoLocation = '';
        var uuid = '';

        function loadCodes() {
            $http({
                url: '/api/shipping/codes',
                method: 'GET'
            }).then(function(res) {
                console.log('countries loaded', res.data);
                $scope.data.countries = res.data;
            }).catch(function(e) {
                console.log('ERROR loading countries', e);
            });
        }

        function loadShipping() {
            if (!uuid) {
                console.log('No location selected');
                return;
            }

            $http({
                url: '/api/shipping/calc/' + uuid,
                method: 'GET'
            }).then(function(res) {
                console.log('shipping data', res.data);

                $scope.$applyAsync(function() {
                    $scope.data.shipping = res.data;

                    if ($scope.data.selectedCountry && autoLocation) {
                        $scope.data.shipping.location =
                            $scope.data.selectedCountry.name +
                            ' ' +
                            autoLocation;
                    }
                });
            }).catch(function(e) {
                console.log('ERROR loading shipping', e);
                $scope.data.shipping = null;
            });
        }

        $scope.countryChanged = function() {
            console.log('selected country', $scope.data.selectedCountry);

            $scope.data.selectedLocation = '';
            $scope.data.shipping = null;
            autoLocation = '';
            uuid = '';

            if ($scope.data.selectedCountry) {
                $scope.data.disableCity = false;
            } else {
                $scope.data.disableCity = true;
            }
        };

        function buildauto() {
            autoLocation = new autoComplete({
                selector: 'input[id=location]',

                source: function(term, suggest) {
                    console.log('autocomplete term', term);

                    $scope.data.shipping = null;
                    uuid = '';

                    if (!$scope.data.selectedCountry || term.length < 3) {
                        suggest([]);
                        return;
                    }

                    $http({
                        url: '/api/shipping/match/' +
                            $scope.data.selectedCountry.code +
                            '/' +
                            term,
                        method: 'GET'
                    }).then(function(res) {
                        console.log('suggestions', res.data);
                        suggest(res.data);
                    }).catch(function(e) {
                        console.log('ERROR loading suggestions', e);
                        suggest([]);
                    });
                },

                renderItem: function(item, search) {
                    return '<div class="autocomplete-suggestion" loc-uuid="' +
                        item.uuid +
                        '" data-val="' +
                        item.name +
                        '">' +
                        item.name +
                        '</div>';
                },

                onSelect: function(e, term, item) {
                    console.log('selected location', term);

                    uuid = item.getAttribute('loc-uuid');
                    autoLocation = item.getAttribute('data-val');

                    $scope.$apply(function() {
                        $scope.data.selectedLocation = autoLocation;
                    });

                    loadShipping();
                }
            });
        }

        $scope.confirmShipping = function() {
            console.log('Buy clicked');
            console.log('shipping object:', $scope.data.shipping);
            console.log('current user id:', currentUser.uniqueid);

            if (!$scope.data.shipping) {
                alert('Please select a valid delivery location first');
                return;
            }

            var shippingPayload = {
                cost: $scope.data.shipping.cost || 49.0,
                delivery: $scope.data.shipping.delivery || '2-4 days',
                distance: $scope.data.shipping.distance || 0,
                location: $scope.data.shipping.location || (
                    ($scope.data.selectedCountry ? $scope.data.selectedCountry.name : '') +
                    ' ' +
                    ($scope.data.selectedLocation || '')
                )
            };

            console.log('shipping payload:', shippingPayload);

            $http({
                url: '/api/shipping/confirm/' + currentUser.uniqueid,
                method: 'POST',
                data: shippingPayload
            }).then(function(res) {
                console.log('shipping confirmed successfully', res.data);
                currentUser.cart = res.data;
                $location.url('/payment');
            }).catch(function(e) {
                console.log('shipping confirm failed', e);
                console.log('continuing to payment despite shipping confirm failure');

                /*
                 * Demo-safe fallback:
                 * Do not block checkout if shipping confirmation fails.
                 */
                $location.url('/payment');
            });
        };

        console.log('shipform init');
        loadCodes();
        buildauto();
    });

    robotshop.controller('paymentform', function($scope, $http, currentUser) {
        $scope.data = {};
        $scope.data.message = ' ';
        $scope.data.buttonDisabled = false;
        $scope.data.cont = false;
        $scope.data.uniqueid = currentUser.uniqueid;
        $scope.data.cart = currentUser.cart;

        $scope.pay = function() {
            $scope.data.buttonDisabled = true;

            $http({
                url: '/api/payment/pay/' + $scope.data.uniqueid,
                method: 'POST',
                data: $scope.data.cart
            }).then(function(res) {
                console.log('order', res.data);
                $scope.data.message = 'Order placed ' + res.data.orderid;

                $scope.data.cart = {
                    total: 0,
                    items: []
                };

                currentUser.cart = $scope.data.cart;
                $scope.data.cont = true;
            }).catch(function(e) {
                console.log('ERROR', e);
                $scope.data.message = 'ERROR placing order';
                $scope.data.buttonDisabled = false;
            });
        };

        console.log('paymentform init');
    });

    robotshop.controller('loginform', function($scope, $http, currentUser) {
        $scope.data = {};
        $scope.data.name = '';
        $scope.data.email = '';
        $scope.data.password = '';
        $scope.data.password2 = '';
        $scope.data.message = '';
        $scope.data.user = {};

        $scope.login = function() {
            $scope.data.message = '';

            $http({
                url: '/api/user/login',
                method: 'POST',
                data: {
                    name: $scope.data.name,
                    password: $scope.data.password
                }
            }).then(function(res) {
                var oldId = currentUser.uniqueid;

                $scope.data.user = res.data;
                $scope.data.user.password = '';
                $scope.data.password = '';
                $scope.data.password2 = '';

                currentUser.user = $scope.data.user;
                currentUser.uniqueid = $scope.data.user.name;

                $http({
                    url: '/api/cart/rename/' + oldId + '/' + $scope.data.user.name,
                    method: 'GET'
                }).then(function(res) {
                    console.log('cart moved OK');
                }).catch(function(e) {
                    console.log('ERROR', e);
                });

                loadHistory(currentUser.user.name);
            }).catch(function(e) {
                console.log('ERROR', e);
                $scope.data.message = 'ERROR ' + e.data;
                $scope.data.password = '';
            });
        };

        $scope.register = function() {
            $scope.data.message = '';
            $scope.data.name = $scope.data.name.trim();
            $scope.data.email = $scope.data.email.trim();
            $scope.data.password = $scope.data.password.trim();
            $scope.data.password2 = $scope.data.password2.trim();

            if (
                $scope.data.name &&
                $scope.data.email &&
                $scope.data.password &&
                $scope.data.password2
            ) {
                if ($scope.data.password !== $scope.data.password2) {
                    $scope.data.message = 'Passwords do not match';
                    $scope.data.password = '';
                    $scope.data.password2 = '';
                    return;
                }
            }

            $http({
                url: '/api/user/register',
                method: 'POST',
                data: {
                    name: $scope.data.name,
                    email: $scope.data.email,
                    password: $scope.data.password
                }
            }).then(function(res) {
                $scope.data.user = {
                    name: $scope.data.name,
                    email: $scope.data.email
                };

                $scope.data.password = '';
                $scope.data.password2 = '';
                currentUser.user = $scope.data.user;
                currentUser.uniqueid = $scope.data.user.name;
            }).catch(function(e) {
                console.log('ERROR', e);
                $scope.data.message = 'ERROR ' + e.data;
                $scope.data.password = '';
                $scope.data.password2 = '';
            });
        };

        function loadHistory(id) {
            $http({
                url: '/api/user/history/' + id,
                method: 'GET'
            }).then(function(res) {
                console.log('history', res.data);
                $scope.data.orderHistory = res.data.history;
            }).catch(function(e) {
                console.log('ERROR', e);
            });
        }

        console.log('loginform init');

        if (!angular.equals(currentUser.user, {})) {
            $scope.data.user = currentUser.user;
            loadHistory(currentUser.user.name);
        }
    });

    robotshop.controller('notfoundform', function($scope, $location) {
        $scope.data = {};
        $scope.data.product = {
            sku: 'HPTD'
        };

        $scope.goHome = function() {
            $location.url('/');
        };
    });

})(window.angular);