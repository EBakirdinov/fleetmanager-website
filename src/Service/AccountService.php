<?php

namespace App\Service;

use PhpParser\Node\Expr\Cast\Object_;
use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\HttpFoundation\Session\SessionInterface;
use Psr\Container\ContainerInterface;

class AccountService extends ApiClient
{
    public function __construct(ContainerInterface $container, RequestStack $requestStack, SessionInterface $session)
    {
        parent::__construct($container, $requestStack, $session);
    }

    public function isAuthenticated()
    {
        return (bool) $this->getCurrentUser();
    }
    
    public function getToken() {
        $token = $this->session->get('stoken');
        if (!$token) {
            $request = $this->requestStack->getCurrentRequest();
            $encryptedToken = $request->cookies->get('scheduler_rememberme');
            if ($encryptedToken) {
                $token = $this->decryptLoginToken($encryptedToken);

                if ($token) {
                    $this->session->set('stoken', $token);
                }
            }
        }

        return $token;
    }

    public function getCurrentUser() {
        $token = $this->getToken();

        if (!$token) {
            return null;
        }

        $chunks = explode('.', $token);
        if (empty($chunks[1])) {
            return null;
        }

        $dataString = base64_decode($chunks[1]);
        $decoded = json_decode($dataString, true);

        return $decoded;
    }

    public function isOwner() {
        $user = $this->getCurrentUser();
        if (!$user) {
            return false;
        }

        foreach ($user['roles'] as $userRole) {
            if ($userRole == SecurityService::ROLE_OWNER) {
                return true;
            }
        }

        return false;
    }

    public function isExpiredAccount() {
        $user = $this->getCurrentUser();
        if (!$user) {
            return false;
        }

        $companyPlanExpirationDate = isset($this->getUserData('company')['valid_until']) ? strtotime($this->getUserData('company')['valid_until']) : false;
        $currentDate = strtotime("now");

        $expired = $companyPlanExpirationDate < $currentDate ? true : false;

        return $expired;
    }

    public function login($data) {
        // API's json_login expects `username`, and the User entity uses email as username.
        $payload = [
            'username' => $data['email'] ?? ($data['username'] ?? null),
            'password' => $data['password'] ?? null,
        ];
        $result = $this->requestWithStatus('login_check', 'POST', $payload);
        if ($result['status'] >= 200 && $result['status'] < 300 && !empty($result['body']['token'])) {
            $this->session->set('stoken', $result['body']['token']);
        }
        return $result;
    }

    public function forgotpassword($data) {
        return $this->requestWithStatus('public/forgot-password', 'POST', $data);
    }

    public function register($data) {
        $result = $this->requestWithStatus('register', 'POST', $data);
        if ($result['status'] >= 200 && $result['status'] < 300 && !empty($result['body']['token'])) {
            $this->session->set('stoken', $result['body']['token']);
        }
        return $result;
    }

    public function logout() 
    {
        $this->session->remove('stoken');
    }

    function encryptLoginToken($token)
    {
        $output = false;
        $encrypt_method = "AES-256-CBC";

        $secret_key = $this->container->getParameter('sso_secret');
        $secret_iv = $this->container->getParameter('sso_iv');

        // hash
        $key = hash('sha256', $secret_key);
        
        // iv - encrypt method AES-256-CBC expects 16 bytes - else you will get a warning
        $iv = substr(hash('sha256', $secret_iv), 0, 16);
    
        $output = openssl_encrypt($token, $encrypt_method, $key, 0, $iv);
        $output = base64_encode($output);

        return $output;
    }

    function decryptLoginToken($token)
    {
        $output = false;
        $encrypt_method = "AES-256-CBC";

        $secret_key = $this->container->getParameter('sso_secret');
        $secret_iv = $this->container->getParameter('sso_iv');

        // hash
        $key = hash('sha256', $secret_key);
        
        // iv - encrypt method AES-256-CBC expects 16 bytes - else you will get a warning
        $iv = substr(hash('sha256', $secret_iv), 0, 16);
        
        $output = openssl_decrypt(base64_decode($token), $encrypt_method, $key, 0, $iv);

        return $output;
    }

    function getAuthorizationHeaders() {
        if (!$this->isAuthenticated()) {
            return array();
        }

        return array('Authorization' => 'Bearer ' . $this->getToken());
    }

    function getUserData($field = null) {
        $userData = $this->getCurrentUser();
        if (!$userData) {
            return null;
        }

        $headers = $this->getAuthorizationHeaders();
        $result = $this->requestWithStatus('self/info', 'GET', null, $headers);

        if ($result['status'] < 200 || $result['status'] >= 300 || !is_array($result['body'])) {
            return null;
        }

        $body = $result['body'];
        // Legacy envelope support: {outcome:'success', data:{...}}
        if (isset($body['outcome']) && $body['outcome'] === 'success' && isset($body['data'])) {
            $body = $body['data'];
        }

        // JMS Serializer defaults to snake_case keys; normalize to camelCase for the React SPA.
        $body = $this->snakeToCamelKeys($body);

        return $field !== null ? ($body[$field] ?? null) : $body;
    }

    private function snakeToCamelKeys(array $data): array {
        $result = [];
        foreach ($data as $key => $value) {
            $camelKey = is_string($key)
                ? lcfirst(str_replace('_', '', ucwords($key, '_')))
                : $key;
            $result[$camelKey] = is_array($value) ? $this->snakeToCamelKeys($value) : $value;
        }
        return $result;
    }

    function updateUserData($data, $session) {
        if (!$this->isAuthenticated()) {
            return false;
        }

        $headers = $this->getAuthorizationHeaders();
        $responseArray = $this->request('self/info', 'PATCH', $data, $headers);

        if (isset($responseArray['outcome']) && $responseArray['outcome'] == 'success') {
            if (isset($responseArray['data']) && isset($responseArray['data']['token'])) {
                $token = $responseArray['data']['token'];

                $return = array(
                    'result' => true
                );

                $response = new JsonResponse($return);

                // store JWT token to session
                $session->set('stoken', $token);

                $encryptedToken = $this->encryptLoginToken($token);
                $loginCookie = new Cookie('scheduler_rememberme', $encryptedToken, time() + (3600 * 10));

                $response->headers->setCookie($loginCookie);

                return $return;
            } else {
                return $responseArray;
            }
        }

        return false;
    }

    function updateProfilePassword($id, $data) {
        $headers = $this->getAuthorizationHeaders();

        return $this->request('member/' . $id . '/password', 'PATCH', $data, $headers, true);
    }

    function resetPassword($id, $data) {
        $headers = $this->getAuthorizationHeaders();

        return $this->request('member/' . $id . '/reset_password', 'PATCH', $data, $headers, true);
    }

    function changePassword($data) {
        $headers = $this->getAuthorizationHeaders();
        
        return $this->request('sso/change_password', 'POST', $data, $headers, true);
    }

    public function getJobsList()
    {
        $userData = $this->getCurrentUser();
        if (!$userData) {
            return null;
        }

        $headers = $this->getAuthorizationHeaders();
        $responseArray = $this->request('self/job', 'GET', null, $headers);

        if (isset($responseArray['outcome']) && $responseArray['outcome'] == 'success') {
            return $responseArray['data'];
        }

        return null;
    }

    public function setInvitationPassword($hash, $data)
    {
        return $this->request('public/member/' . $hash, 'PATCH', $data, null);
    }

    public function getInfoByHash($hash)
    {
        return $this->request('public/member/' . $hash, 'GET', null, null);
    }

    public function stripeSessionSave($data) {
        $headers = $this->getAuthorizationHeaders();

        return $this->request('payment/stripe-session', 'POST', $data, $headers, true);
    }
}