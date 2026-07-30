<?php

namespace App\Service;

use GuzzleHttp\Client;

use Psr\Container\ContainerInterface;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\HttpFoundation\Session\SessionInterface;

class ApiClient
{
    protected $container;

    protected $requestStack;
    
    protected $session;

    protected $client;

    public function __construct(ContainerInterface $container, RequestStack $requestStack, SessionInterface $session)
    {
        $this->container = $container;
        $this->requestStack = $requestStack;
        $this->session = $session;

        $this->client = new Client([
            'verify' => false,
            'base_uri' => $this->container->getParameter('api_url')
        ]);
    }

    public function request($path, $method = 'GET', $body = null, array $headers = null)
    {
        $result = $this->requestWithStatus($path, $method, $body, $headers);
        return $result['body'];
    }

    /**
     * Same as request() but returns both HTTP status and decoded body.
     * Never throws; failed requests return status 0 with a body of ['error' => '...'].
     */
    public function requestWithStatus($path, $method = 'GET', $body = null, array $headers = null): array
    {
        $options = ['headers' => ['Content-Type' => 'application/json']];

        if ($headers !== null && is_array($headers)) {
            $options['headers'] = array_merge($options['headers'], $headers);
        }

        if (is_array($body) && count($body)) {
            $options['body'] = json_encode($body);
        }

        $status = 0;
        $rawBody = '';

        try {
            $response = $this->client->request($method, $path, $options);
            $status = $response->getStatusCode();
            $rawBody = (string) $response->getBody();
        } catch (\GuzzleHttp\Exception\BadResponseException $e) {
            $resp = $e->getResponse();
            if ($resp) {
                $status = $resp->getStatusCode();
                $rawBody = (string) $resp->getBody();
            } else {
                return ['status' => 0, 'body' => ['error' => $e->getMessage()]];
            }
        } catch (\Exception $e) {
            return ['status' => 0, 'body' => ['error' => $e->getMessage()]];
        }

        $decoded = json_decode($rawBody, true);
        return ['status' => $status, 'body' => $decoded === null ? $rawBody : $decoded];
    }

    public function multipartRequest($path, $files, array $headers = null)
    {
        $options = array();

        $options['headers'] = array();

//        $options['headers']['auto-auth'] = 'Bearer ' . $this->container->getParameter('auto_auth');

        if ($headers != null && is_array($headers)) {
            $options['headers'] = array_merge($options['headers'], $headers);
        }

        $options['multipart'] = array(); 
        foreach ($files as $file) {
            $options['multipart'][] = array('name' => $file['name'], 'contents' => fopen($file['filename'], 'r'));
        }

        try {
            $response = $this->client->post($path, $options);
            $responseBody = $response->getBody();
        } catch( \Exception $e) {
            $responseBody = $e->getResponse()->getBody();
        }
        $responseArray = json_decode($responseBody, true);

        return $responseArray;
    }
}